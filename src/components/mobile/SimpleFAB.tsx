import React from 'react';

interface SimpleFABProps {
  isOpen: boolean;
  onToggle: () => void;
}

export const SimpleFAB: React.FC<SimpleFABProps> = ({ isOpen, onToggle }) => {
  const handleToggle = () => {
    console.log('FAB button clicked!');
    onToggle();
  };

  return (
    <div style={{
      position: 'relative',
      display: 'flex',
      alignItems: 'center',
      gap: '12px',
    }}>
      <button
        onClick={handleToggle}
        style={{
          width: '56px',
          height: '56px',
          borderRadius: '50%',
          background: isOpen ? 'linear-gradient(135deg, #ff6b6b, #e74c3c)' : 'linear-gradient(135deg, #6c63ff, #4a47e0)',
          border: 'none',
          color: 'white',
          fontSize: '24px',
          fontWeight: 'bold',
          cursor: 'pointer',
          boxShadow: '0 4px 12px rgba(108, 99, 255, 0.4)',
          transition: 'all 0.3s ease',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          transform: isOpen ? 'rotate(45deg)' : 'rotate(0deg)',
        }}
      >
        {isOpen ? '✕' : '☰'}
      </button>
      
      {isOpen && (
        <div style={{
          display: 'flex',
          gap: '8px',
          position: 'absolute',
          left: '70px',
          top: '50%',
          transform: 'translateY(-50%)',
        }}>
          <button
            onClick={() => console.log('Save clicked')}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            💾
          </button>
          <button
            onClick={() => console.log('Share clicked')}
            style={{
              width: '48px',
              height: '48px',
              borderRadius: '50%',
              background: 'rgba(255, 255, 255, 0.1)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: 'white',
              fontSize: '20px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            🔗
          </button>
        </div>
      )}
    </div>
  );
};
