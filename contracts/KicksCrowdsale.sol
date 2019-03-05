pragma solidity ^0.5.0;

import "openzeppelin-solidity/contracts/crowdsale/emission/AllowanceCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/validation/TimedCrowdsale.sol";
import "openzeppelin-solidity/contracts/crowdsale/Crowdsale.sol";
import "openzeppelin-solidity/contracts/token/ERC20/ERC20.sol";

contract KicksCrowdsale is Crowdsale, TimedCrowdsale, AllowanceCrowdsale {

    using SafeMath for uint256;

    uint256 private _kickCap = 33333333 ether;
    uint256 private _kickMinPay = 100 ether;
    uint256 private _kickPurchased = 0;

    uint256 private _rateEthUsd = 135.54 ether;
    uint256 private _rateUsdEth = 0.007386 ether;
    uint256 private _rateKickUsd = 1.5 ether;
    uint256 private _rateUsdKick = 0.666667 ether;

    uint256 private _bonus20capBoundary =  666666 ether;
    uint256 private _bonus10capBoundary = 1333333 ether;

    address private _manualSeller;
    address private _rateSetter;

    event Bonus(address indexed purchaser, address indexed beneficiary, uint256 value, uint256 amount);
    event ChangeRate(uint256 ethUsd, uint256 usdEth);

    constructor(
        uint256 rate, // not used, calculated based on _rateEthUsd
        ERC20 token, // the kick token address
        address payable wallet, // accumulation eth address
        address tokenWallet, // kick storage address
        address manualSeller, // can sell tokens
        address rateSetter, // can change eth rate
        uint256 openingTime,
        uint256 closingTime
    )
    Crowdsale(rate, wallet, token)
    AllowanceCrowdsale(tokenWallet)
    TimedCrowdsale(openingTime, closingTime)
    public
    {
        _manualSeller = manualSeller;
        _rateSetter = rateSetter;
    }


    /**
     * Conversion rates
     */
    function _ethToUsd(uint256 eth) internal view returns (uint256) {
        return eth.mul(_rateEthUsd).div(1 ether);
    }

    function _ethToKick(uint256 eth) internal view returns (uint256) {
        return _usdToKick(_ethToUsd(eth));
    }

    function _usdToEth(uint256 usd) internal view returns (uint256) {
        return usd.mul(_rateUsdEth).div(1 ether);
    }

    function _usdToKick(uint256 usd) internal view returns (uint256) {
        return usd.mul(_rateUsdKick).div(1 ether);
    }


    /**
     * Base crowdsale override
     */
    function _preValidatePurchase(address beneficiary, uint256 weiAmount) internal view {
        uint256 kickAmount = _ethToKick(weiAmount);
        require(kickAmount >= _kickMinPay, 'Min purchase 100 kick');
        require(_kickPurchased.add(kickAmount) <= _kickCap, 'Cap has been reached');
        super._preValidatePurchase(beneficiary, weiAmount);
    }

    function calcBonus(uint256 tokenAmount) internal view returns (uint256) {
        uint256 bonus = 0;
        if (_kickPurchased < _bonus20capBoundary) {
            bonus = tokenAmount.mul(20).div(100);
        } else if (_kickPurchased < _bonus10capBoundary) {
            bonus = tokenAmount.mul(10).div(100);
        }
        return bonus;
    }

    function _getTokenAmount(uint256 weiAmount) internal view returns (uint256) {
        uint256 tokenAmount = _ethToKick(weiAmount);
        return tokenAmount.add(calcBonus(tokenAmount));
    }

    function _updatePurchasingState(address beneficiary, uint256 weiAmount) internal {
        _kickPurchased = _kickPurchased.add(_ethToKick(weiAmount));
        uint256 bonus = calcBonus(_getTokenAmount(weiAmount));
        if (bonus != 0) {
            emit Bonus(msg.sender, beneficiary, weiAmount, bonus);
        }
    }


    /**
     * Manual sell
     */
    function manualSell(address beneficiary, uint256 usd) public onlyWhileOpen {
        require(msg.sender == _manualSeller);
        uint256 weiAmount = _usdToEth(usd);
        uint256 tokenAmount = _getTokenAmount(weiAmount);
        _preValidatePurchase(beneficiary, weiAmount);
        _processPurchase(beneficiary, tokenAmount);
        emit TokensPurchased(msg.sender, beneficiary, weiAmount, tokenAmount);
        _updatePurchasingState(beneficiary, weiAmount);
    }


    /**
     * Change eth rate
     */
    function setRateEthUsd(uint256 ethUsd, uint256 usdEth) public {
        require(msg.sender == _rateSetter);
        _rateEthUsd = ethUsd;
        _rateUsdEth = usdEth;
        emit ChangeRate(ethUsd, usdEth);
    }


    /**
     * Getters
     */
    function kickCap() public view returns (uint256) {
        return _kickCap;
    }

    function kickMinPay() public view returns (uint256) {
        return _kickMinPay;
    }

    function kickPurchased() public view returns (uint256) {
        return _kickPurchased;
    }

    function rateEthUsd() public view returns (uint256) {
        return _rateEthUsd;
    }

    function rateUsdEth() public view returns (uint256) {
        return _rateUsdEth;
    }

    function rateKickUsd() public view returns (uint256) {
        return _rateKickUsd;
    }

    function rateUsdKick() public view returns (uint256) {
        return _rateUsdKick;
    }

    function bonus20capBoundary() public view returns (uint256) {
        return _bonus20capBoundary;
    }

    function bonus10capBoundary() public view returns (uint256) {
        return _bonus10capBoundary;
    }
}
