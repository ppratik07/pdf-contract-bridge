import Handlebars from 'handlebars';

interface ContractData {
  type: string;
  parties: string[];
  terms: {
    payment?: string;
    duration?: string;
    trigger?: string;
    startDate?: string;
    endDate?: string;
    obligations?: string[];
  };
}

/**
 * Generate Solidity smart contract from extracted contract data
 */
export async function generateSolidityContract(contractData: ContractData): Promise<string> {
  const template = getSolidityTemplate();
  const compiledTemplate = Handlebars.compile(template);

  const templateContext = {
    contractName: sanitizeContractName(contractData.type),
    description: `${contractData.type} contract between ${contractData.parties.join(', ')}`,
    parties: contractData.parties,
    paymentTerms: contractData.terms.payment || 'Not specified',
    duration: contractData.terms.duration || 'Not specified',
    trigger: contractData.terms.trigger || 'Manual trigger',
    amount: contractData.terms.payment || '0',
    obligations: (contractData.terms.obligations || []).join('; '),
    timestamp: new Date().toISOString(),
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
    
    // Escrow state
    mapping(address => uint256) public escrowBalance;
    uint256 public totalEscrow = 0;
    
    // Contract details
    string public contractType = "{{contractName}}";
    string public description = "{{description}}";
    uint256 public contractStartDate;
    uint256 public contractEndDate;
    uint256 public contractExpirationDate; // Auto-expires after 10 days
    uint256 public constant EXPIRATION_PERIOD = 10 days;
    string public paymentTerms = "{{paymentTerms}}";
    string public contractDuration = "{{duration}}";
    string public triggerCondition = "{{trigger}}";
    string public obligations = "{{obligations}}";
    
    // Contract state
    enum ContractStatus { PENDING, EXECUTED, COMPLETED, EXPIRED }
    ContractStatus public contractStatus = ContractStatus.PENDING;
    bool public isExecuted = false;
    bool public isCompleted = false;
    
    // Events
    event ContractExecuted(uint256 timestamp, address[] parties);
    event ContractCompleted(uint256 timestamp);
    event EscrowLocked(address indexed depositor, uint256 amount, uint256 timestamp);
    event PaymentProcessed(address indexed recipient, uint256 amount, uint256 timestamp);
    event EscrowReleased(address indexed recipient, uint256 amount, uint256 timestamp);
    event ContractExpired(uint256 timestamp);
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
    
    modifier notExpired() {
        require(block.timestamp <= contractExpirationDate, "Contract has expired");
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
        contractExpirationDate = block.timestamp + EXPIRATION_PERIOD; // Auto-expire in 10 days
    }
    
    /**
     * @notice Deposit funds into escrow
     */
    function depositToEscrow() public payable onlyParties notExpired {
        require(msg.value > 0, "Deposit amount must be greater than 0");
        require(contractStatus == ContractStatus.PENDING, "Can only deposit in PENDING state");
        
        escrowBalance[msg.sender] += msg.value;
        totalEscrow += msg.value;
        
        emit EscrowLocked(msg.sender, msg.value, block.timestamp);
    }
    
    /**
     * @notice Get escrow balance for an address
     */
    function getEscrowBalance(address _address) public view returns (uint256) {
        return escrowBalance[_address];
    }
    
    /**
     * @notice Execute the contract and lock funds
     */
    function executeContract() public onlyParties notExecuted notExpired {
        require(totalEscrow > 0, "Escrow must have funds before execution");
        isExecuted = true;
        contractStatus = ContractStatus.EXECUTED;
        emit ContractExecuted(block.timestamp, parties);
    }
    
    /**
     * @notice Mark contract as completed and release escrow
     */
    function completeContract() public onlyParties isExecutedCheck notExpired {
        require(!isCompleted, "Contract already completed");
        require(contractStatus == ContractStatus.EXECUTED, "Contract must be executed first");
        
        isCompleted = true;
        contractStatus = ContractStatus.COMPLETED;
        emit ContractCompleted(block.timestamp);
    }
    
    /**
     * @notice Release escrow funds to recipient on trigger/completion
     * Trigger Condition: {{trigger}}
     * Payment Terms: {{paymentTerms}}
     * @param recipient Address to receive escrow funds
     */
    function releaseEscrow(address payable recipient) public onlyParties isExecutedCheck notExpired {
        require(isParty(recipient), "Recipient must be a contract party");
        require(isCompleted, "Contract must be completed to release escrow");
        require(escrowBalance[recipient] > 0, "No escrow balance for recipient");
        
        uint256 amount = escrowBalance[recipient];
        escrowBalance[recipient] = 0;
        totalEscrow -= amount;
        
        recipient.transfer(amount);
        emit EscrowReleased(recipient, amount, block.timestamp);
    }
    
    /**
     * @notice Process payment according to contract terms
     * @param recipient Address to receive payment
     */
    function processPayment(address payable recipient) public payable isExecutedCheck notExpired {
        require(msg.value > 0, "Payment amount must be greater than 0");
        require(isParty(recipient), "Recipient must be a contract party");
        
        recipient.transfer(msg.value);
        emit PaymentProcessed(recipient, msg.value, block.timestamp);
    }
    
    /**
     * @notice Handle contract expiration after 10 days
     */
    function expireContract() public {
        require(block.timestamp > contractExpirationDate, "Contract has not expired yet");
        require(contractStatus != ContractStatus.EXPIRED, "Contract already marked as expired");
        
        contractStatus = ContractStatus.EXPIRED;
        
        // Return all escrowed funds to depositors
        for (uint256 i = 0; i < parties.length; i++) {
            if (escrowBalance[parties[i]] > 0) {
                uint256 amount = escrowBalance[parties[i]];
                escrowBalance[parties[i]] = 0;
                payable(parties[i]).transfer(amount);
            }
        }
        
        totalEscrow = 0;
        emit ContractExpired(block.timestamp);
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
     */
    function getStatus() public view returns (string memory) {
        if (block.timestamp > contractExpirationDate) {
            return "EXPIRED";
        } else if (isCompleted) {
            return "COMPLETED";
        } else if (isExecuted) {
            return "ACTIVE";
        } else {
            return "PENDING";
        }
    }
    
    /**
     * @notice Get contract details
     */
    function getDetails() public view returns (
        string memory _type,
        address[] memory _parties,
        uint256 _startDate,
        uint256 _expirationDate,
        bool _executed,
        bool _completed,
        uint256 _totalEscrow
    ) {
        return (
            contractType,
            parties,
            contractStartDate,
            contractExpirationDate,
            isExecuted,
            isCompleted,
            totalEscrow
        );
    }
    
    /**
     * @notice Get contract terms
     */
    function getTerms() public view returns (
        string memory _paymentTerms,
        string memory _duration,
        string memory _trigger,
        string memory _obligations
    ) {
        return (paymentTerms, contractDuration, triggerCondition, obligations);
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
