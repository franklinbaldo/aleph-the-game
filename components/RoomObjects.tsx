import React from 'react';
import { Search, Book, Wind } from 'lucide-react';

interface RoomObjectsProps {
  onInteract: (text: string, sentiment: 'obsessive' | 'intellectual' | 'passive') => void;
  disabled: boolean;
}

const RoomObjects: React.FC<RoomObjectsProps> = ({ onInteract, disabled }) => {
  const items = [
    { 
      id: 'desk', 
      label: 'Cluttered Desk', 
      icon: Search, 
      text: 'Examine the details of the cluttered desk', 
      sentiment: 'intellectual' as const 
    },
    { 
      id: 'book', 
      label: 'Uncut Books', 
      icon: Book, 
      text: 'Inspect the uncut pages of the books I brought her', 
      sentiment: 'passive' as const 
    },
    { 
      id: 'dust', 
      label: 'Scent of Dust', 
      icon: Wind, 
      text: 'Focus on the scent of the room', 
      sentiment: 'obsessive' as const 
    },
  ];

  return (
    <div className="flex flex-wrap gap-3 my-6 animate-in fade-in slide-in-from-bottom-2 duration-700 delay-300">
      {items.map((item) => (
        <button
          key={item.id}
          onClick={() => onInteract(item.text, item.sentiment)}
          disabled={disabled}
          className="
            flex items-center gap-2 px-3 py-2 
            bg-gray-900/40 border border-gray-800 rounded 
            hover:bg-gray-800 hover:border-gray-600 
            transition-all duration-300 
            text-xs font-mono text-gray-400 uppercase tracking-wider
            disabled:opacity-50 disabled:cursor-not-allowed
            group
          "
        >
          <item.icon className="w-3 h-3 text-gray-600 group-hover:text-green-400 transition-colors" />
          <span>{item.label}</span>
        </button>
      ))}
    </div>
  );
};

export default RoomObjects;