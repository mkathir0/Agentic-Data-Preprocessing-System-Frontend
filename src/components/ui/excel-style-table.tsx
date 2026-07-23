"use client";

import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";
import { Copy, Download } from "lucide-react";

interface ExcelTableProps {
  data: string[][];
  headers?: string[];
  editable?: boolean;
  className?: string;
  onCellChange?: (row: number, col: number, value: string) => void;
}

interface SelectionRange {
  startRow: number;
  startCol: number;
  endRow: number;
  endCol: number;
}

export const ExcelTable: React.FC<ExcelTableProps> = ({
  data,
  headers,
  editable = false,
  className,
  onCellChange,
}) => {
  const [selectedCells, setSelectedCells] = useState<Set<string>>(new Set());
  const [selectionRange, setSelectionRange] = useState<SelectionRange | null>(null);
  const [editingCell, setEditingCell] = useState<{ row: number; col: number } | null>(null);
  const [editValue, setEditValue] = useState("");
  const [draggedCell, setDraggedCell] = useState<{ row: number; col: number } | null>(null);
  const [isSelecting, setIsSelecting] = useState(false);
  const [copyMsg, setCopyMsg] = useState(false);
  const tableRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  const getCellKey = (row: number, col: number) => `${row}-${col}`;

  const updateSelectedCells = (range: SelectionRange) => {
    const cells = new Set<string>();
    const minRow = Math.min(range.startRow, range.endRow);
    const maxRow = Math.max(range.startRow, range.endRow);
    const minCol = Math.min(range.startCol, range.endCol);
    const maxCol = Math.max(range.startCol, range.endCol);
    for (let r = minRow; r <= maxRow; r++) {
      for (let c = minCol; c <= maxCol; c++) {
        cells.add(getCellKey(r, c));
      }
    }
    setSelectedCells(cells);
  };

  const handleCellClick = (row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    if (e.detail === 2) return;
    if (e.shiftKey && selectionRange) {
      const newRange: SelectionRange = { startRow: selectionRange.startRow, startCol: selectionRange.startCol, endRow: row, endCol: col };
      setSelectionRange(newRange);
      updateSelectedCells(newRange);
    } else if (e.detail === 1) {
      const newRange = { startRow: row, startCol: col, endRow: row, endCol: col };
      setSelectionRange(newRange);
      updateSelectedCells(newRange);
    }
  };

  const handleCellDoubleClick = (row: number, col: number, e: React.MouseEvent) => {
    e.stopPropagation();
    e.preventDefault();
    setIsSelecting(false);
    setDraggedCell(null);
    if (editable) {
      setEditingCell({ row, col });
      setEditValue(data[row]?.[col] || "");
    }
  };

  const handleRowHeaderClick = (rowIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRange: SelectionRange = { startRow: rowIndex, startCol: 0, endRow: rowIndex, endCol: (data[0]?.length || 1) - 1 };
    setSelectionRange(newRange);
    updateSelectedCells(newRange);
  };

  const handleColHeaderClick = (colIndex: number, e: React.MouseEvent) => {
    e.stopPropagation();
    const newRange: SelectionRange = { startRow: 0, startCol: colIndex, endRow: data.length - 1, endCol: colIndex };
    setSelectionRange(newRange);
    updateSelectedCells(newRange);
  };

  const handleMouseDown = (row: number, col: number, e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();
    const clearSel = () => window.getSelection()?.removeAllRanges();
    clearSel();
    setTimeout(clearSel, 0);
    setIsSelecting(true);
    setDraggedCell({ row, col });
    const newRange = { startRow: row, startCol: col, endRow: row, endCol: col };
    setSelectionRange(newRange);
    updateSelectedCells(newRange);
  };

  const handleMouseEnter = (row: number, col: number) => {
    if (isSelecting && draggedCell) {
      const newRange: SelectionRange = { startRow: draggedCell.row, startCol: draggedCell.col, endRow: row, endCol: col };
      setSelectionRange(newRange);
      updateSelectedCells(newRange);
    }
  };

  const handleEditSubmit = () => {
    if (editingCell && onCellChange) onCellChange(editingCell.row, editingCell.col, editValue);
    setEditingCell(null);
    setEditValue("");
  };

  const handleEditKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter") { e.preventDefault(); handleEditSubmit(); }
    else if (e.key === "Escape") { e.preventDefault(); setEditingCell(null); setEditValue(""); }
  };

  const copyToClipboard = useCallback(() => {
    if (selectedCells.size === 0) return;
    const sorted = Array.from(selectedCells).map(key => { const [r, c] = key.split("-").map(Number); return { row: r, col: c, value: data[r]?.[c] || "" }; }).sort((a, b) => a.row - b.row || a.col - b.col);
    const rowsMap = new Map<number, string[]>();
    sorted.forEach(cell => { if (!rowsMap.has(cell.row)) rowsMap.set(cell.row, []); rowsMap.get(cell.row)!.push(cell.value); });
    const text = Array.from(rowsMap.values()).map(r => r.join("\t")).join("\n");
    navigator.clipboard.writeText(text).then(() => { setCopyMsg(true); setTimeout(() => setCopyMsg(false), 2000); }).catch(() => {});
  }, [selectedCells, data]);

  const exportToCSV = useCallback(() => {
    const csvContent = [...(headers ? [headers.join(",")] : []), ...data.map(row => row.map(cell => `"${cell}"`).join(","))].join("\n");
    const blob = new Blob([csvContent], { type: "text/csv" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url; a.download = "table-data.csv"; a.click();
    URL.revokeObjectURL(url);
  }, [data, headers]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => { if ((e.ctrlKey || e.metaKey) && e.key === "c") copyToClipboard(); };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [copyToClipboard]);

  useEffect(() => {
    const onUp = () => { setIsSelecting(false); setDraggedCell(null); };
    const onSel = () => { if (isSelecting) window.getSelection()?.removeAllRanges(); };
    const onSelectStart = (e: Event) => { if (isSelecting) e.preventDefault(); };
    document.addEventListener("mouseup", onUp);
    document.addEventListener("selectionchange", onSel);
    document.addEventListener("selectstart", onSelectStart, true);
    return () => { document.removeEventListener("mouseup", onUp); document.removeEventListener("selectionchange", onSel); document.removeEventListener("selectstart", onSelectStart, true); };
  }, [isSelecting]);

  useEffect(() => {
    if (editingCell && inputRef.current) { inputRef.current.focus(); inputRef.current.select(); }
  }, [editingCell]);

  const isCellSelected = (row: number, col: number) => selectedCells.has(getCellKey(row, col));
  const isRowSelected = (row: number) => { for (let col = 0; col < (data[0]?.length || 0); col++) { if (!selectedCells.has(getCellKey(row, col))) return false; } return selectedCells.size > 0; };
  const isColSelected = (col: number) => { for (let row = 0; row < data.length; row++) { if (!selectedCells.has(getCellKey(row, col))) return false; } return selectedCells.size > 0; };

  return (
    <div className={cn("w-full", className)} ref={tableRef}>
      {/* Toolbar */}
      <div className="flex justify-between items-center mb-3">
        <span className="text-xs font-mono text-gray-500">
          {data.length} rows × {headers?.length ?? 0} cols
          {selectedCells.size > 0 && <span className="ml-3 text-[#00F0FF]">{selectedCells.size} selected</span>}
        </span>
        <div className="flex gap-2">
          <button
            onClick={copyToClipboard}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 hover:text-white rounded-lg transition-colors"
          >
            <Copy className="w-3 h-3" />
            {copyMsg ? "Copied!" : "Copy (⌘C)"}
          </button>
          <button
            onClick={exportToCSV}
            className="flex items-center gap-1.5 px-3 py-1 text-xs bg-[#00F0FF]/10 hover:bg-[#00F0FF]/20 border border-[#00F0FF]/30 text-[#00F0FF] rounded-lg transition-colors"
          >
            <Download className="w-3 h-3" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Table */}
      <div className={cn("border border-white/10 rounded-xl overflow-hidden bg-[#050505]", isSelecting && "select-none")}>
        <div className="overflow-auto max-h-96">
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-white/5 sticky top-0 z-10">
                <th className="w-10 h-8 border-b border-r border-white/10 text-xs font-mono font-medium text-gray-600 cursor-pointer hover:bg-white/10">
                  #
                </th>
                {headers?.map((header, colIndex) => (
                  <th
                    key={colIndex}
                    onClick={(e) => handleColHeaderClick(colIndex, e)}
                    className={cn(
                      "min-w-28 h-8 border-b border-r border-white/10 px-2 text-xs font-mono font-semibold text-gray-400 text-left cursor-pointer hover:bg-white/10 whitespace-nowrap",
                      isColSelected(colIndex) && "text-[#00F0FF] border-t border-t-[#00F0FF]"
                    )}
                  >
                    {header}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.map((row, rowIndex) => (
                <motion.tr
                  key={rowIndex}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: Math.min(rowIndex * 0.01, 0.3) }}
                  className={cn(
                    "hover:bg-white/3 transition-colors",
                    rowIndex % 2 === 0 ? "bg-transparent" : "bg-white/[0.02]",
                    isRowSelected(rowIndex) && "bg-[#00F0FF]/5"
                  )}
                >
                  <td
                    onClick={(e) => handleRowHeaderClick(rowIndex, e)}
                    className="w-10 h-7 border-b border-r border-white/5 text-xs font-mono font-medium text-gray-700 text-center cursor-pointer hover:bg-white/10"
                  >
                    {rowIndex + 1}
                  </td>
                  {row.map((cell, colIndex) => (
                    <td
                      key={colIndex}
                      className={cn(
                        "min-w-28 h-7 border-b border-r border-white/5 px-2 text-xs font-mono relative cursor-pointer transition-colors",
                        "hover:bg-[#00F0FF]/5",
                        isCellSelected(rowIndex, colIndex) && "bg-[#00F0FF]/10 border border-[#00F0FF]/40",
                        editingCell?.row === rowIndex && editingCell?.col === colIndex && "p-0"
                      )}
                      onClick={(e) => handleCellClick(rowIndex, colIndex, e)}
                      onDoubleClick={(e) => handleCellDoubleClick(rowIndex, colIndex, e)}
                      onMouseDown={(e) => handleMouseDown(rowIndex, colIndex, e)}
                      onMouseEnter={() => handleMouseEnter(rowIndex, colIndex)}
                      onMouseUp={() => { setIsSelecting(false); setDraggedCell(null); }}
                    >
                      {editingCell?.row === rowIndex && editingCell?.col === colIndex ? (
                        <input
                          ref={inputRef}
                          type="text"
                          value={editValue}
                          onChange={(e) => setEditValue(e.target.value)}
                          onBlur={handleEditSubmit}
                          onKeyDown={handleEditKeyDown}
                          onMouseDown={(e) => e.stopPropagation()}
                          className="w-full h-full px-2 text-xs font-mono bg-[#001a1a] border-0 outline-none text-[#00F0FF]"
                          autoFocus
                        />
                      ) : (
                        <span className="truncate block text-gray-300">{cell}</span>
                      )}
                    </td>
                  ))}
                </motion.tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};
