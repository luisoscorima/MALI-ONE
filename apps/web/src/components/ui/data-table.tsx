import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type ColumnDef,
} from '@tanstack/react-table';
import { Fragment, type CSSProperties, type ReactNode } from 'react';

import { cn } from '@/lib/utils';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';

export type DataTableColumnMeta = {
  className?: string;
  headerClassName?: string;
  cellClassName?: string;
};

type DataTableProps<TData, TValue = unknown> = {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  emptyMessage?: string;
  getRowId?: (originalRow: TData, index: number) => string;
  onRowClick?: (row: TData) => void;
  isRowExpanded?: (row: TData) => boolean;
  renderExpandedRow?: (row: TData) => ReactNode;
  tableClassName?: string;
  tableStyle?: CSSProperties;
  containerClassName?: string;
  toolbar?: ReactNode;
  footer?: ReactNode;
};

export function DataTable<TData, TValue = unknown>({
  columns,
  data,
  emptyMessage = 'Sin resultados.',
  getRowId,
  onRowClick,
  isRowExpanded,
  renderExpandedRow,
  tableClassName,
  tableStyle,
  containerClassName,
  toolbar,
  footer,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    getRowId,
  });

  const colCount = Math.max(columns.length, 1);

  function metaOf(column: { columnDef: { meta?: unknown } }) {
    return column.columnDef.meta as DataTableColumnMeta | undefined;
  }

  return (
    <div className={cn('space-y-4', containerClassName)}>
      {toolbar}
      <div className="overflow-x-auto rounded-md border">
        <Table className={tableClassName} style={tableStyle}>
          <TableHeader>
            {table.getHeaderGroups().map((headerGroup) => (
              <TableRow key={headerGroup.id}>
                {headerGroup.headers.map((header) => {
                  const meta = metaOf(header.column);
                  return (
                    <TableHead
                      key={header.id}
                      className={cn(meta?.className, meta?.headerClassName)}
                    >
                      {header.isPlaceholder
                        ? null
                        : flexRender(
                            header.column.columnDef.header,
                            header.getContext(),
                          )}
                    </TableHead>
                  );
                })}
              </TableRow>
            ))}
          </TableHeader>
          <TableBody>
            {table.getRowModel().rows.length ? (
              table.getRowModel().rows.map((row) => {
                const original = row.original;
                const expanded = Boolean(isRowExpanded?.(original));
                return (
                  <Fragment key={row.id}>
                    <TableRow
                      data-state={expanded ? 'selected' : undefined}
                      className={onRowClick ? 'cursor-pointer' : undefined}
                      onClick={
                        onRowClick ? () => onRowClick(original) : undefined
                      }
                    >
                      {row.getVisibleCells().map((cell) => {
                        const meta = metaOf(cell.column);
                        return (
                          <TableCell
                            key={cell.id}
                            className={cn(meta?.className, meta?.cellClassName)}
                          >
                            {flexRender(
                              cell.column.columnDef.cell,
                              cell.getContext(),
                            )}
                          </TableCell>
                        );
                      })}
                    </TableRow>
                    {expanded && renderExpandedRow ? (
                      <TableRow className="bg-muted/20 hover:bg-muted/20">
                        <TableCell colSpan={colCount} className="p-0">
                          {renderExpandedRow(original)}
                        </TableCell>
                      </TableRow>
                    ) : null}
                  </Fragment>
                );
              })
            ) : (
              <TableRow>
                <TableCell colSpan={colCount} className="h-24 text-center">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            )}
          </TableBody>
        </Table>
      </div>
      {footer}
    </div>
  );
}
