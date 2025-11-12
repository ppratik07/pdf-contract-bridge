/**
 * Get block explorer URL for contract address
 */
export function getBlockExplorerUrl(
  blockchain: string,
  contractAddress: string
): string {
  const urls: { [key: string]: string } = {
    POLYGON:
      blockchain === "POLYGON"
        ? `https://mumbai.polygonscan.com/address/${contractAddress}`
        : "",
    ETHEREUM:
      blockchain === "ETHEREUM"
        ? `https://sepolia.etherscan.io/address/${contractAddress}`
        : "",
  };

  return urls[blockchain] || "";
}