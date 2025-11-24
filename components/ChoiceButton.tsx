import React from 'react';
import { motion } from 'framer-motion';
import { Choice } from '../types';

interface ChoiceButtonProps {
  choice: Choice;
  onClick: (id: string) => void;
  disabled: boolean;
}

const ChoiceButton: React.FC<ChoiceButtonProps> = ({ choice, onClick, disabled }) => {
  return (
    <motion.button
      initial={{ opacity: 0, x: 10 }}
      animate={{ opacity: 1, x: 0 }}
      whileHover={{ scale: 1.02 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onClick(choice.id)}
      disabled={disabled}
      className={`
        w-[85vw] sm:w-auto sm:min-w-[300px] max-w-[400px] flex-shrink-0 snap-center
        text-left p-4
        border border-gray-800 rounded-lg
        bg-gray-950/40 backdrop-blur-sm
        transition-all duration-500
        text-gray-400 font-serif
        hover:border-gray-600 hover:bg-gray-900 hover:text-gray-200
        shadow-lg shadow-black/50
        ${disabled ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}
      `}
    >
      {/* Sentiment label removed for ambiguity */}
      <span className="block leading-tight text-sm sm:text-base italic opacity-90">
        "{choice.text}"
      </span>
    </motion.button>
  );
};

export default ChoiceButton;