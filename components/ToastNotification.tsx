import React, { useEffect } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastNotificationProps {
  message: string | null;
  onClose: () => void;
}

const ToastNotification: React.FC<ToastNotificationProps> = ({ message, onClose }) => {
  useEffect(() => {
    if (message) {
      const timer = setTimeout(onClose, 4000);
      return () => clearTimeout(timer);
    }
  }, [message, onClose]);

  return (
    <AnimatePresence>
      {message && (
        <motion.div
          initial={{ opacity: 0, y: -20, x: '-50%' }}
          animate={{ opacity: 1, y: 0, x: '-50%' }}
          exit={{ opacity: 0, y: -20, x: '-50%' }}
          className="fixed top-24 left-1/2 transform -translate-x-1/2 z-50 bg-red-950/90 text-red-200 px-6 py-3 rounded shadow-[0_0_20px_rgba(220,38,38,0.2)] border border-red-900/50 backdrop-blur-md font-mono text-xs sm:text-sm uppercase tracking-widest text-center min-w-[300px]"
        >
          {message.split('\n').map((line, i) => (
            <div key={i} className={i > 0 ? "mt-1" : ""}>{line}</div>
          ))}
        </motion.div>
      )}
    </AnimatePresence>
  );
};

export default ToastNotification;