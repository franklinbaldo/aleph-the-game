import React from 'react';
import { motion } from 'framer-motion';
import { Choice } from '../types';

interface ChoiceButtonProps {
  choice: Choice;
  onClick: (id: string) => void;
  disabled: boolean;
}

const ChoiceButton: React.FC<ChoiceButtonProps> = ({ choice, onClick, disabled }) => {
  const getBorderColor = () => {
    switch (choice.sentiment) {
      case 'aggressive': return 'hover:border-red-500 hover:text-red-300';
      case 'obsessive': return 'hover:border-purple-500 hover:text-purple-300';
      case 'intellectual': return 'hover:border-blue-500 hover:text-blue-300';
      default: return 'hover:border-green-500 hover:text-green-300';
    }
  };

  return (
    <motion.button
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(choice.id)}
      disabled={disabled}
      className={`
        min-w-[260px] sm:min-w-[300px] max-w-[300px] flex-shrink-0 snap-center
        text-left p-4
        border border-gray-700 rounded-lg
        bg-gray-900/50 backdrop-blur-sm
        transition-all duration-300
        text-gray-400 font-serif
        ${getBorderColor()}
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      <span className="mr-3 text-xs uppercase tracking-widest opacity-50 block mb-1">
        [{choice.sentiment || 'act'}]
      </span>
      <span className="block leading-tight">
        {choice.text}
      </span>
    </motion.button>
  );
};

export default ChoiceButton;