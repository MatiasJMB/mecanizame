import { createContext, useContext, useEffect, useState, type ReactNode } from 'react';
import { useLocation } from 'react-router-dom';

// Buscador global: un solo input (en el Shell) filtra la página activa.
type SearchContextValue = { query: string; setQuery: (q: string) => void };

const SearchContext = createContext<SearchContextValue>({ query: '', setQuery: () => {} });

export function SearchProvider({ children }: { children: ReactNode }) {
  const [query, setQuery] = useState('');
  const { pathname } = useLocation();

  // Al cambiar de sección, la búsqueda anterior deja de tener sentido.
  useEffect(() => { setQuery(''); }, [pathname]);

  return <SearchContext.Provider value={{ query, setQuery }}>{children}</SearchContext.Provider>;
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSearch() {
  return useContext(SearchContext);
}
