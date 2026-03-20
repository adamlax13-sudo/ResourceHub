import { useState, useCallback } from "react";

interface UseAdminPaginationOptions {
  defaultPageSize?: number;
  total: number;
  pageSizeOptions?: number[];
}

interface UseAdminPaginationReturn {
  page: number;
  pageSize: number;
  totalPages: number;
  setPage: (page: number | ((prev: number) => number)) => void;
  setPageSize: (size: number) => void;
  resetPage: () => void;
}

export function useAdminPagination({
  defaultPageSize = 25,
  total,
}: UseAdminPaginationOptions): UseAdminPaginationReturn {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSizeRaw] = useState(defaultPageSize);

  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  const setPageSize = useCallback((size: number) => {
    setPageSizeRaw(size);
    setPage(1);
  }, []);

  const resetPage = useCallback(() => setPage(1), []);

  return { page, pageSize, totalPages, setPage, setPageSize, resetPage };
}
