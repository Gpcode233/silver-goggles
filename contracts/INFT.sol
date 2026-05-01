// SPDX-License-Identifier: MIT
// ERC-7857 reference INFT contract per 0G Labs documentation.
// https://docs.0g.ai/developer-hub/building-on-0g/inft/integration
pragma solidity ^0.8.19;

import "@openzeppelin/contracts/token/ERC721/ERC721.sol";
import "@openzeppelin/contracts/access/Ownable.sol";
import "@openzeppelin/contracts/security/ReentrancyGuard.sol";

interface IOracle {
    function verifyProof(bytes calldata proof) external view returns (bool);
}

contract INFT is ERC721, Ownable, ReentrancyGuard {
    mapping(uint256 => bytes32) private _metadataHashes;
    mapping(uint256 => string) private _encryptedURIs;
    mapping(uint256 => mapping(address => bytes)) private _authorizations;

    address public oracle;
    uint256 private _nextTokenId = 1;

    event MetadataUpdated(uint256 indexed tokenId, bytes32 newHash);
    event UsageAuthorized(uint256 indexed tokenId, address indexed executor);
    event Minted(uint256 indexed tokenId, address indexed to, string encryptedURI, bytes32 metadataHash);

    constructor(string memory name_, string memory symbol_, address _oracle) ERC721(name_, symbol_) {
        oracle = _oracle;
    }

    function mint(address to, string calldata encryptedURI, bytes32 metadataHash)
        external
        onlyOwner
        returns (uint256)
    {
        uint256 tokenId = _nextTokenId++;
        _safeMint(to, tokenId);

        _encryptedURIs[tokenId] = encryptedURI;
        _metadataHashes[tokenId] = metadataHash;

        emit Minted(tokenId, to, encryptedURI, metadataHash);
        return tokenId;
    }

    function transfer(
        address from,
        address to,
        uint256 tokenId,
        bytes calldata sealedKey,
        bytes calldata proof
    ) external nonReentrant {
        require(ownerOf(tokenId) == from, "Not owner");
        require(IOracle(oracle).verifyProof(proof), "Invalid proof");

        _updateMetadataAccess(tokenId, to, sealedKey, proof);
        _transfer(from, to, tokenId);

        emit MetadataUpdated(tokenId, keccak256(sealedKey));
    }

    function authorizeUsage(uint256 tokenId, address executor, bytes calldata permissions) external {
        require(ownerOf(tokenId) == msg.sender, "Not owner");
        _authorizations[tokenId][executor] = permissions;
        emit UsageAuthorized(tokenId, executor);
    }

    function _updateMetadataAccess(
        uint256 tokenId,
        address /* newOwner */,
        bytes calldata /* sealedKey */,
        bytes calldata proof
    ) internal {
        require(proof.length >= 32, "Proof too short");
        bytes32 newHash = bytes32(proof[0:32]);
        _metadataHashes[tokenId] = newHash;

        if (proof.length > 64) {
            string memory newURI = string(proof[64:]);
            _encryptedURIs[tokenId] = newURI;
        }
    }

    function getMetadataHash(uint256 tokenId) external view returns (bytes32) {
        return _metadataHashes[tokenId];
    }

    function getEncryptedURI(uint256 tokenId) external view returns (string memory) {
        return _encryptedURIs[tokenId];
    }

    function tokenURI(uint256 tokenId) public view override returns (string memory) {
        _requireMinted(tokenId);
        return _encryptedURIs[tokenId];
    }
}
