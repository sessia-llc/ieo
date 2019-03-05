pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract KicksToken is ERC20 {

    string private _name = 'Sessia Kicks';
    string private _symbol = 'KICK';
    uint8 private _decimals = 18;

    constructor(address founder) public {
        _mint(founder, 100000000000000000000000000);
    }

    function name() public view returns (string memory) {
        return _name;
    }

    function symbol() public view returns (string memory) {
        return _symbol;
    }

    function decimals() public view returns (uint8) {
        return _decimals;
    }
}
