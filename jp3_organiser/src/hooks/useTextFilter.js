import { useCallback } from 'react';
import { useSearchParams } from 'react-router-dom';

/**
 * Read the command bar's filter text from the URL (?q=).
 * @returns {[string, Function]} the text ('' when there is none) and a function that removes it
 */
export function useTextFilter() {
  const [searchParams, setSearchParams] = useSearchParams();

  const clear = useCallback(() => {
    setSearchParams((params) => {
      params.delete('q');
      return params;
    }, { replace: true });
  }, [setSearchParams]);

  return [searchParams.get('q') ?? '', clear];
}
