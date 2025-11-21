
import React from 'react';
import { Objective } from '../types';
import { CheckCircle2, Circle, Lock } from 'lucide-react';

interface ObjectiveTrackerProps {
  objectives: Objective[];
}

const ObjectiveTracker: React.FC<ObjectiveTrackerProps> = ({ objectives }) => {
  // Find the first incomplete objective to highlight it
  const currentObjectiveIndex = objectives.findIndex(o => !o.completed);
  
  return (
    <div className="fixed top-20 right-6 w-64 z-40 hidden lg:block">
      <div className="bg-black/80 backdrop-blur border border-gray-800 rounded-lg p-4 shadow-xl">
        <h3 className="text-xs font-mono uppercase tracking-widest text-gray-500 mb-4 border-b border-gray-800 pb-2">
          Current Objectives
        </h3>
        <div className="space-y-3">
          {objectives.map((obj, index) => {
            const isCompleted = obj.completed;
            const isCurrent = index === currentObjectiveIndex;
            const isLocked = !isCompleted && !isCurrent;

            return (
              <div 
                key={obj.id} 
                className={`flex items-start gap-3 transition-all duration-500 ${isLocked ? 'opacity-30 blur-[1px]' : 'opacity-100'}`}
              >
                <div className="mt-0.5 shrink-0">
                  {isCompleted ? (
                    <CheckCircle2 className="w-4 h-4 text-green-500" />
                  ) : isLocked ? (
                    <Lock className="w-3 h-3 text-gray-600" />
                  ) : (
                    <div className="relative">
                      <Circle className="w-4 h-4 text-yellow-500 animate-pulse" />
                      <div className="absolute inset-0 bg-yellow-500/20 blur-sm rounded-full animate-pulse" />
                    </div>
                  )}
                </div>
                <div className="space-y-1">
                  <p className={`text-xs font-serif font-bold ${isCompleted ? 'text-gray-500 line-through' : 'text-gray-200'}`}>
                    {obj.label}
                  </p>
                  {!isLocked && !isCompleted && (
                    <p className="text-[10px] text-gray-400 font-mono leading-tight">
                      {obj.description}
                    </p>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};

export default ObjectiveTracker;
