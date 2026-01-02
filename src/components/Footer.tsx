
'use client';

import React from 'react';

const Footer: React.FC = () => {
  return (
    <footer className="text-center p-4 text-sm text-muted-foreground border-t mt-auto bg-background/80 backdrop-blur-sm">
      Slottic &copy; {new Date().getFullYear()}
    </footer>
  );
};

export default Footer;
