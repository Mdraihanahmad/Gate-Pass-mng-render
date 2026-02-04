import React from 'react';

function DataTableBase({ columns, data, maxHeight, containerClassName = '' }) {
  const style = maxHeight ? { maxHeight: typeof maxHeight === 'number' ? `${maxHeight}px` : maxHeight } : undefined;
  return (
    <div className={`overflow-auto border rounded animate-fade-in ${containerClassName}`} style={style}>
      <table className="min-w-full text-left text-sm">
        <thead className="sticky top-0 z-10 bg-gray-100 dark:bg-gray-700 dark:text-gray-100 shadow-sm">
          <tr>
            {columns.map((c) => (
              <th key={c.key} className="px-2 md:px-3 py-2 font-semibold whitespace-nowrap">{c.title}</th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((row) => (
            <tr key={row._id || JSON.stringify(row)} className="border-t border-gray-200 dark:border-gray-700 odd:bg-white even:bg-gray-50 dark:odd:bg-gray-800 dark:even:bg-gray-900 hover:bg-blue-50/60 dark:hover:bg-blue-900/30 transition-colors">
              {columns.map((c) => (
                <td key={c.key} className="px-2 md:px-3 py-2 align-top whitespace-nowrap">{c.render ? c.render(row[c.key], row) : String(row[c.key] ?? '')}</td>
              ))}
            </tr>
          ))}
          {data.length === 0 && (
            <tr>
              <td className="px-3 py-10 text-center text-gray-500 dark:text-gray-400" colSpan={columns.length}>
                <div className="flex flex-col items-center gap-2">
                  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-8 h-8 text-gray-300 dark:text-gray-600">
                    <path fillRule="evenodd" d="M2.25 6.75A2.25 2.25 0 014.5 4.5h15a2.25 2.25 0 012.25 2.25v10.5A2.25 2.25 0 0119.5 19.5h-15a2.25 2.25 0 01-2.25-2.25V6.75zm3 0a.75.75 0 00-.75.75v9a.75.75 0 00.75.75h13.5a.75.75 0 00.75-.75v-9a.75.75 0 00-.75-.75H5.25z" clipRule="evenodd" />
                  </svg>
                  <div>No data</div>
                </div>
              </td>
            </tr>
          )}
        </tbody>
      </table>
    </div>
  );
}

const DataTable = React.memo(DataTableBase);
export default DataTable;
