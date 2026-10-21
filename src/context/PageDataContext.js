import { createContext, useContext } from 'react';

// Each server request gets its own value; browser navigation still refreshes live data.
export const PageDataContext = createContext({});
export const MetadataContext = createContext(null);
export const usePageData = () => useContext(PageDataContext);
