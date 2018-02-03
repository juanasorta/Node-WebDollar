import NodesList from 'node/lists/nodes-list';
import InterfaceSatoshminDB from 'common/satoshmindb/Interface-SatoshminDB'
import BlockchainMiningReward from 'common/blockchain/global/Blockchain-Mining-Reward';

const BigNumber = require('bignumber.js');

class PoolLeaderProtocol {

    constructor(dataBase) {

        NodesList.emitter.on("nodes-list/connected", (result) => {
            this._subscribeMiner(result)
        });
        NodesList.emitter.on("nodes-list/disconnected", (result) => {
            this._unsubscribeMiner(result)
        });

        if (dataBase === undefined)
            this.db = new InterfaceSatoshminDB();
        else
            this.db = dataBase;

        this.blockchainReward = BlockchainMiningReward.getReward();
        this.hashTarget = new Buffer("00978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb", "hex"); //target difficulty;

    }

    _subscribeMiner(nodesListObject) {

        let socket = nodesListObject.socket;

        socket.node.sendRequest("mining-pool-protocol/create-minner-task", (data) => {

            try {

                this.createMinerTask();

            } catch (exception) {

                console.log("Failed to send task to minner");

            }

        });

        socket.node.on("mining-pool-protocol/get-minner-work", (data) => {

            let higherHash = this.getHigherHashDifficulty(data);

            this.poolHigherHashesList(higherHash, data.address);

        });

    }

    _unsubscribeMiner(nodesListObject) {

        let socket = nodesListObject.socket;

    }

    createMinerTask() {

        //To create minner task puzzle

    }

    getHigherHashDifficulty(hashList) {

        let higherHash = new Buffer("00978112ca1bbdcafac231b39a23dc4da786eff8147c4e72b9807785afee48bb", "hex"); //target difficulty;

        for (let i = 0; i < hashList.length; ++i) {

            if (hashList[i].compare(higherHash) <= 0) {

                higherHash = hashList[i];

            }

        }

        return higherHash;

    }

    poolHigherHashesList(hash, minerAddress) {

        let higherHashList;

    }

    setMinnersRewardPrecentage() {


    }

    // Calculate difficulty for all hasses using the list of best hasses from each minner
    //
    // Parameters:
    // - target hash
    // - hashList
    //      -> Structure
    //          hashList.address (minner identifier address)
    //          hashList.hash (minner best hash)
    //          hashList.reward (WEBD reward)
    //          hashList.difficulty (will be filed by this function)
    //
    //  Return:
    //  - hashList
    //
    generateHashDificulties(target, hashList) {

        let hashTargetNumber = new BigInteger(target.toString('hex'), 16);

        for (let i = 0; i < hashList.length; ++i) {

            let currentHash = new BigInteger(hashList[i].hash.toString('hex'), 16);

            hashList[i].difficulty = new BigNumber(currentHash).dividedBy(hashTargetNumber);

        }

        return hashList;

    }

    // Calculate rewards for pool using the list of best hasses from each minner
    //
    // Parameters:
    // - total reward
    // - pool leader commission
    // - hashList
    //      -> Structure
    //          hashList.address (minner identifier address)
    //          hashList.hash (minner best hash)
    //          hashList.reward (will be filled by this function)
    //
    //  Return:
    //  - hashList
    //
    rewardsDistribution(reward,poolLeaderCommission,hashList){

        // Convert to bignumber
        reward = new BigNumber(reward);

        let poolLeaderReward = new BigNumber(reward.dividedBy(100)).multiply(poolLeaderCommission);
        let minnersReward =  new BigNumber(reward).minus(poolLeaderReward);

        // Create hash difficulties list from all minners best hasses
        let hashDifficultiesList = this.generateHashDificulties(this.hashTarget,hashList);

        // Calculate total of Difficulties list
        let totalDifficulties =  new BigNumber(0);
        for (let i=0; i<hashDifficultiesList.length; i++){

            totalDifficulties = totalDifficulties.plus(hashDifficultiesList[i]);

        }

        // Add to hashList rewards for each minner
        for (let i=0; i<hashDifficultiesList.length; i++){

            let currentDifficultyPercent = Math.floor((hashDifficultiesList[i] / totalDifficulties) * 100);
            currentDifficultyPercent = currentDifficultyPercent.multiply(100);

            let currentMinerReward = new BigNumber(currentDifficultyPercent).dividedBy(100);
            currentMinerReward = currentMinerReward.multiply(minnersReward);
            hashList[i].reward = currentMinerReward;

            minnersReward = minnersReward.minus(currentMinerReward);

        }

        return {
            poolLeader: poolLeaderReward,
            minners: hashList
        }

    }

    async saveMinersRewards(address,minnerReward){

        try{
            return (await this.db.save(address, minnerReward));
        }
        catch (exception){
            console.log(colors.red('ERROR saving miner reward in BD: '),  exception);
            throw exception;
        }

    }

}

export default new PoolLeaderProtocol();