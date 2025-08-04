import React from 'react';

const StatCard = ({ title, value, icon: Icon, color = "blue" }) => (
  <div className="bg-white rounded-lg shadow-sm border-l-4 border-blue-500 p-4">
    <div className="flex items-center justify-between">
      <div>
        <p className="text-sm text-gray-600">{title}</p>
        <p className="text-2xl font-bold text-gray-900">{value || '0'}</p>
      </div>
      <Icon className="w-8 h-8 text-blue-500" />
    </div>
  </div>
);

export default StatCard;