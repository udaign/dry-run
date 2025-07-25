
import { useState, useCallback } from 'react';

export const useHistory = <T,>(initialState: T) => {
    const [history, setHistory] = useState<T[]>([initialState]);
    const [index, setIndex] = useState(0);

    const setState = useCallback((action: React.SetStateAction<T>) => {
        const resolvedState = typeof action === 'function' 
            ? (action as (prevState: T) => T)(history[index]) 
            : action;

        if (JSON.stringify(resolvedState) === JSON.stringify(history[index])) {
            return;
        }
        
        const newHistory = history.slice(0, index + 1);
        newHistory.push(resolvedState);
        setHistory(newHistory);
        setIndex(newHistory.length - 1);
    }, [history, index]);

    const undo = useCallback(() => {
        if (index > 0) {
            setIndex(index - 1);
        }
    }, [index]);

    const redo = useCallback(() => {
        if (index < history.length - 1) {
            setIndex(index + 1);
        }
    }, [index, history.length]);
    
    const reset = useCallback((overrideState?: Partial<T>) => {
        const newState = { ...initialState, ...overrideState };
        const newHistory = history.slice(0, index + 1);
        newHistory.push(newState);
        setHistory(newHistory);
        setIndex(newHistory.length - 1);
    }, [initialState, history, index]);

    return {
        state: history[index],
        setState,
        undo,
        redo,
        reset,
        canUndo: index > 0,
        canRedo: index < history.length - 1,
    };
};
