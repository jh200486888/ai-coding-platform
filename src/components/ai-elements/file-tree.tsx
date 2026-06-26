"use client";

import React, { useState, useCallback } from "react";
import { ChevronRight, File, Folder, FolderOpen } from "lucide-react";
import { cn } from "@/lib/utils";

interface FileTreeProps {
  expanded?: Set<string>;
  defaultExpanded?: Set<string>;
  onSelect?: (path: string) => void;
  onExpandedChange?: (expanded: Set<string>) => void;
  className?: string;
  children?: React.ReactNode;
}

function FileTree({ defaultExpanded, onSelect, onExpandedChange, className, children }: FileTreeProps) {
  const [internalExpanded, setInternalExpanded] = useState<Set<string>>(defaultExpanded ?? new Set());

  const toggle = useCallback((path: string) => {
    const next = new Set(internalExpanded);
    if (next.has(path)) next.delete(path);
    else next.add(path);
    setInternalExpanded(next);
    onExpandedChange?.(next);
  }, [internalExpanded, onExpandedChange]);

  const handleSelect = useCallback((path: string) => {
    onSelect?.(path);
  }, [onSelect]);

  return (
    <div className={cn("text-sm select-none", className)} data-tree-context="true" data-toggle={toggle} data-select={handleSelect} data-expanded={internalExpanded}>
      {children}
    </div>
  );
}

// Internal context to share state
const TreeContext = React.createContext<{
  expanded: Set<string>;
  toggle: (path: string) => void;
  select: (path: string) => void;
}>({ expanded: new Set(), toggle: () => {}, select: () => {} });

interface FileTreeFolderProps {
  path?: string;
  name?: string;
  className?: string;
  children?: React.ReactNode;
}

function FileTreeFolder({ path = "", name = "", className, children }: FileTreeFolderProps) {
  return (
    <TreeFolderInternal path={path} name={name} className={className}>
      {children}
    </TreeFolderInternal>
  );
}

function TreeFolderInternal({ path, name, className, children }: FileTreeFolderProps) {
  const [localOpen, setLocalOpen] = useState(false);

  return (
    <div>
      <button
        onClick={() => setLocalOpen(!localOpen)}
        className={cn("flex items-center gap-1 w-full px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors text-left", className)}
      >
        <ChevronRight className={cn("w-3.5 h-3.5 transition-transform duration-200 shrink-0", localOpen && "rotate-90")} />
        {localOpen ? (
          <FolderOpen className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        ) : (
          <Folder className="w-3.5 h-3.5 text-violet-400 shrink-0" />
        )}
        <span className="truncate">{name}</span>
      </button>
      {localOpen && (
        <div className="ml-4 border-l border-border/50 pl-1">
          {children}
        </div>
      )}
    </div>
  );
}

interface FileTreeFileProps {
  path?: string;
  name?: string;
  icon?: React.ReactNode;
  className?: string;
}

function FileTreeFile({ path = "", name = "", icon, className }: FileTreeFileProps) {
  return (
    <button
      onClick={() => {}}
      className={cn("flex items-center gap-1.5 w-full px-1.5 py-0.5 rounded hover:bg-muted/50 transition-colors text-left group", className)}
    >
      {icon || <File className="w-3.5 h-3.5 text-muted-foreground shrink-0 group-hover:text-foreground" />}
      <span className="truncate text-muted-foreground group-hover:text-foreground">{name}</span>
    </button>
  );
}

function FileTreeIcon({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <span className={cn("shrink-0", className)}>{children}</span>;
}

function FileTreeName({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <span className={cn("truncate", className)}>{children}</span>;
}

function FileTreeActions({ children, className }: { children?: React.ReactNode; className?: string }) {
  return <div className={cn("flex items-center gap-1 ml-auto opacity-0 group-hover:opacity-100 transition-opacity", className)} onClick={(e) => e.stopPropagation()}>{children}</div>;
}

export { FileTree, FileTreeFolder, FileTreeFile, FileTreeIcon, FileTreeName, FileTreeActions };
