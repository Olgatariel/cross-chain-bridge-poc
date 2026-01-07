import { CHAINS } from '../config/chains';

function NetworkSelector({ currentChainId, selectedDirection, onDirectionChange, onSwitchNetwork }) {
  const directions = [
    { from: CHAINS.BASE_SEPOLIA, to: CHAINS.POLYGON_AMOY, label: 'Base → Polygon' },
    { from: CHAINS.POLYGON_AMOY, to: CHAINS.BASE_SEPOLIA, label: 'Polygon → Base' }
  ];

  const currentDirection = directions[selectedDirection];
  const isOnCorrectChain = currentChainId === currentDirection.from.id;

  return (
    <div className="bg-white rounded-lg shadow-lg p-4 mb-6">
      <div className="flex items-center justify-between">
        {/* Direction Toggle */}
        <div className="flex items-center space-x-3">
          <span className="text-sm font-medium text-gray-600">Bridge Direction:</span>
          <div className="flex bg-gray-100 rounded-lg p-1">
            {directions.map((dir, index) => (
              <button
                key={index}
                onClick={() => onDirectionChange(index)}
                className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                  selectedDirection === index
                    ? 'bg-white text-gray-900 shadow'
                    : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {dir.label}
              </button>
            ))}
          </div>
        </div>

        {/* Network Switch Button */}
        {!isOnCorrectChain && (
          <button
            onClick={() => onSwitchNetwork(currentDirection.from.id)}
            className="px-4 py-2 bg-yellow-500 hover:bg-yellow-600 text-white rounded-lg font-medium transition-colors text-sm"
          >
            Switch to {currentDirection.from.name}
          </button>
        )}
      </div>

      {/* Warning if on wrong network */}
      {!isOnCorrectChain && (
        <div className="mt-3 p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
          <p className="text-sm text-yellow-800">
            ⚠️ Please switch to {currentDirection.from.name} to bridge in this direction
          </p>
        </div>
      )}
    </div>
  );
}

export default NetworkSelector;