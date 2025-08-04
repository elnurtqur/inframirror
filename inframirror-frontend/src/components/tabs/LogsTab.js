import React from 'react';
import LogEntry from '../common/LogEntry';

const LogsTab = ({ logs, setLogs }) => {
  return (
    <div className="bg-white rounded-lg shadow-sm">
      <div className="p-6 border-b">
        <div className="flex items-center justify-between">
          <h3 className="text-lg font-semibold">Activity Logs</h3>
          <button
            onClick={() => setLogs([])}
            className="text-red-600 hover:text-red-800 text-sm"
          >
            Clear Logs
          </button>
        </div>
      </div>
      
      <div className="p-6 space-y-3 max-h-96 overflow-y-auto">
        {logs.length === 0 ? (
          <div className="text-center py-8 text-gray-500">
            No logs yet. Start by performing operations.
          </div>
        ) : (
          logs.map((log) => (
            <LogEntry key={log.id} log={log} />
          ))
        )}
      </div>
    </div>
  );
};

export default LogsTab;