import React from 'react';
import clsx from 'clsx';

const Skeleton = ({ className, variant = 'text' }) => {
  const baseClasses = 'animate-pulse bg-gradient-to-r from-bone via-paper to-bone bg-[length:200%_100%] rounded';
  
  const variants = {
    text: 'h-4 w-full',
    card: 'h-32 w-full rounded-xl',
    chart: 'h-64 w-full rounded-xl',
  };

  return (
    <div className={clsx(baseClasses, variants[variant], className)} />
  );
};

export default Skeleton;
