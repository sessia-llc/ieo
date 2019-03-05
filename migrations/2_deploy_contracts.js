const token = artifacts.require('./KicksToken.sol');
const crowdsale = artifacts.require('./KicksCrowdsale.sol');

module.exports = async function (deployer, network, accounts) {
    await deployer.deploy(token, accounts[0]);
    await deployer.deploy(
        crowdsale,
        new web3.utils.BN(1), // not used, calculated based on _rateEthUsd
        token.address, // the kick token address
        accounts[0], // accumulation eth address
        accounts[0], // kick storage address
        accounts[1], // can sell tokens
        accounts[2], // can change eth rate
        '1600000000', // crowdsale opening time
        '1700000000' // crowdsale closing time
    );
    // !!!Then after the crowdsale is created, don't forget to approve it to use your tokens!!!
    // IERC20(tokenAddress).approve(CROWDALE_ADDRESS, SOME_TOKEN_AMOUNT);
};
