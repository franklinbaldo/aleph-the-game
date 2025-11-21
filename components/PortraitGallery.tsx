import React from 'react';

const PortraitGallery: React.FC = () => {
  // Using picsum as requested, but styled to look like old photos
  const portraits = [
    { id: 1, label: "First Communion", url: "https://picsum.photos/200/300?grayscale&random=1" },
    { id: 2, label: "The Wedding", url: "https://picsum.photos/200/300?grayscale&random=2" },
    { id: 3, label: "Carnival '21", url: "https://picsum.photos/200/300?grayscale&random=3" },
    { id: 4, label: "Quilmes", url: "https://picsum.photos/200/300?grayscale&random=4" },
  ];

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 my-8 opacity-60 hover:opacity-100 transition-opacity duration-700">
      {portraits.map((p) => (
        <div key={p.id} className="relative group cursor-pointer">
          <div className="absolute inset-0 bg-sepia-900/40 group-hover:bg-transparent transition-colors duration-500 z-10" />
          <img 
            src={p.url} 
            alt={p.label} 
            className="w-full h-32 object-cover rounded border border-gray-800 sepia brightness-75 contrast-125" 
          />
          <div className="mt-1 text-xs text-center text-gray-500 font-serif italic">{p.label}</div>
        </div>
      ))}
    </div>
  );
};

export default PortraitGallery;
