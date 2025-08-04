import React from 'react';

const PowerStateCard = ({ state, count, icon: Icon, color, totalVMs }) => (
  <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
    <div className="flex items-center justify-between">
      <div className="flex items-center space-x-3">
        <div className={`p-3 rounded-full ${color === 'green' ? 'bg-green-100' : color === 'red' ? 'bg-red-100' : 'bg-yellow-100'}`}>
          <Icon className={`w-6 h-6 ${color === 'green' ? 'text-green-600' : color === 'red' ? 'text-red-600' : 'text-yellow-600'}`} />
        </div>
        <div>
          <p className="text-sm font-medium text-gray-600 capitalize">{state}</p>
          <p className="text-2xl font-bold text-gray-900">{count || 0}</p>
        </div>
      </div>
      <div className="text-right">
        <div className={`text-xs font-medium px-2 py-1 rounded-full ${color === 'green' ? 'text-green-600 bg-green-100' : color === 'red' ? 'text-red-600 bg-red-100' : 'text-yellow-600 bg-yellow-100'}`}>
          {totalVMs ? Math.round((count / totalVMs) * 100) : 0}%
        </div>
      </div>
    </div>
  </div>
);

export default PowerStateCard;