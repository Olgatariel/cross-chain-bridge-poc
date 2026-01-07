import { getExplorerUrl } from '../config/chains';

function TransactionStatus({ status, onClose }) {
  if (!status) return null;

  const { status: state, message, txHash, chainId } = status;

  const explorerUrl =
    txHash && chainId ? getExplorerUrl(chainId, txHash) : null;

  const getStatusColor = () => {
    switch (state) {
      case 'pending':
        return 'bg-blue-50 border-blue-200 text-blue-800';
      case 'processing':
        return 'bg-yellow-50 border-yellow-200 text-yellow-800';
      case 'success':
        return 'bg-green-50 border-green-200 text-green-800';
      case 'error':
        return 'bg-red-50 border-red-200 text-red-800';
      default:
        return 'bg-gray-50 border-gray-200 text-gray-800';
    }
  };

  const getStatusIcon = () => {
    switch (state) {
      case 'pending':
        return (
          <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-blue-600" />
        );
      case 'processing':
        return (
          <svg
            className="w-5 h-5 text-yellow-600 animate-pulse"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 8v4l3 3m6-3a9 9 0 11-18 0 9 9 0 0118 0z"
            />
          </svg>
        );
      case 'success':
        return (
          <svg
            className="w-5 h-5 text-green-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M5 13l4 4L19 7"
            />
          </svg>
        );
      case 'error':
        return (
          <svg
            className="w-5 h-5 text-red-600"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M6 18L18 6M6 6l12 12"
            />
          </svg>
        );
      default:
        return null;
    }
  };

  return (
    <div className={`p-4 rounded-lg border ${getStatusColor()}`}>
      <div className="flex items-start justify-between">
        <div className="flex items-start space-x-3 flex-1">
          <div className="mt-0.5">{getStatusIcon()}</div>

          <div className="flex-1">
            <p className="font-medium">{message}</p>

            {explorerUrl && (
              <a
                href={explorerUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="text-sm underline hover:no-underline mt-2 inline-block"
              >
                View on Explorer →
              </a>
            )}
          </div>
        </div>

        {(state === 'success' || state === 'error') && (
          <button
            onClick={onClose}
            className="ml-4 text-gray-400 hover:text-gray-600"
            aria-label="Close"
          >
            <svg
              className="w-5 h-5"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M6 18L18 6M6 6l12 12"
              />
            </svg>
          </button>
        )}
      </div>
    </div>
  );
}

export default TransactionStatus;