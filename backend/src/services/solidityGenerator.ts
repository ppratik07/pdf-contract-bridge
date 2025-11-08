import Handlebars from 'handlebars';

interface ContractData {
  type: string;
  parties: string[];
  paymentTerms: string | null;
  keyTerms: Record<string, string>;
  summary: string;
}

/**
 * Generate Solidity smart contract from extracted contract data
 */
export async function generateSolidityContract(contractData: ContractData): Promise<string> {
  const template = getSolidityTemplate();
  const compiledTemplate = Handlebars.compile(template);

  const templateContext = {
    contractName: sanitizeContractName(contractData.type),
    description: contractData.summary,
    parties: contractData.parties,
    paymentTerms: contractData.paymentTerms || 'Not specified',
    duration: contractData.keyTerms.duration || 'Not specified',
    amount: contractData.keyTerms.amount || '0',
    venue: contractData.keyTerms.venue || 'Not specified',
    timestamp: new Date().toISOString(),
    ...contractData.keyTerms,
  };

  return compiledTemplate(templateContext);
}

/**
 * Get Solidity contract template using Handlebars
 */
function getSolidityTemplate(): string {
  return `// SPDX-License-Identifier: MIT
pragma solidity ^0.8.20;

/**
 * @title {{contractName}}
 * @notice {{description}}
 * Generated on: {{timestamp}}
 */
contract {{contractName}} {
    // Contract parties
    address[] public parties;
    
    // Contract details
    string public contractType = "{{contractName}}";
    string public description = "{{description}}";
    uint256 public contractStartDate;
    uint256 public contractEndDate;
    uint256 public paymentAmount;
    
    // Contract state
    bool public isExecuted = false;
    bool public isCompleted = false;
    
    // Events
    event ContractExecuted(uint256 timestamp, address[] parties);
    event ContractCompleted(uint256 timestamp);
    event PaymentProcessed(address indexed recipient, uint256 amount);
    event TermsModified(string field, string newValue);
    
    // Modifiers
    modifier onlyParties() {
        require(isParty(msg.sender), "Only contract parties can call this");
        _;
    }
    
    modifier notExecuted() {
        require(!isExecuted, "Contract already executed");
        _;
    }
    
    modifier isExecutedCheck() {
        require(isExecuted, "Contract not yet executed");
        _;
    }
    
    /**
     * @notice Initialize contract with parties and terms
     * @param _parties Array of party addresses
     */
    constructor(address[] memory _parties) {
        require(_parties.length > 0, "At least one party required");
        parties = _parties;
        contractStartDate = block.timestamp;
    }
    
    /**
     * @notice Execute the contract
     */
    function executeContract() public onlyParties notExecuted {
        isExecuted = true;
        emit ContractExecuted(block.timestamp, parties);
    }
    
    /**
     * @notice Mark contract as completed
     */
    function completeContract() public onlyParties isExecutedCheck {
        require(!isCompleted, "Contract already completed");
        isCompleted = true;
        emit ContractCompleted(block.timestamp);
    }
    
    /**
     * @notice Process payment according to contract terms
     * Payment Terms: {{paymentTerms}}
     * Amount: {{amount}}
     */
    function processPayment(address payable recipient) public payable isExecutedCheck {
        require(msg.value > 0, "Payment amount must be greater than 0");
        require(isParty(recipient), "Recipient must be a contract party");
        
        recipient.transfer(msg.value);
        emit PaymentProcessed(recipient, msg.value);
    }
    
    /**
     * @notice Check if address is a contract party
     * @param _address Address to check
     * @return Boolean indicating if address is a party
     */
    function isParty(address _address) public view returns (bool) {
        for (uint256 i = 0; i < parties.length; i++) {
            if (parties[i] == _address) {
                return true;
            }
        }
        return false;
    }
    
    /**
     * @notice Get all contract parties
     * @return Array of party addresses
     */
    function getParties() public view returns (address[] memory) {
        return parties;
    }
    
    /**
     * @notice Get contract status
     * @return status Current contract status
     */
    function getStatus() public view returns (string memory status) {
        if (!isExecuted) {
            return "PENDING";
        } else if (isCompleted) {
            return "COMPLETED";
        } else {
            return "ACTIVE";
        }
    }
    
    /**
     * @notice Get contract details
     * @return _type Contract type
     * @return _parties Parties involved
     * @return _startDate Contract start date
     * @return _executed Execution status
     */
    function getDetails() public view returns (
        string memory _type,
        address[] memory _parties,
        uint256 _startDate,
        bool _executed,
        bool _completed
    ) {
        return (
            contractType,
            parties,
            contractStartDate,
            isExecuted,
            isCompleted
        );
    }
    
    /**
     * @notice Fallback function to receive Ether
     */
    receive() external payable {
        // Allow receiving Ether for contract payments
    }
}
`;
}

/**
 * Sanitize contract name to be valid Solidity identifier
 */
function sanitizeContractName(name: string): string {
  return name
    .replace(/[^a-zA-Z0-9]/g, '_')
    .replace(/^[0-9]/, '_$&') // Can't start with number
    .replace(/_+/g, '_') // Remove multiple underscores
    .substring(0, 100); // Limit length
}

/**
 * Register custom Handlebars helpers
 */
export function registerHandlebarsHelpers(): void {
  Handlebars.registerHelper('capitalize', (str: string) => {
    if (!str) return '';
    return str.charAt(0).toUpperCase() + str.slice(1);
  });

  Handlebars.registerHelper('upper', (str: string) => {
    return str ? str.toUpperCase() : '';
  });

  Handlebars.registerHelper('lower', (str: string) => {
    return str ? str.toLowerCase() : '';
  });

  Handlebars.registerHelper('join', function(array: any[], separator: string) {
    return new Handlebars.SafeString(array.join(separator));
  });
}

registerHandlebarsHelpers();
