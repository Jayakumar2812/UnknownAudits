import { HardhatUserConfig } from "hardhat/config";
import "@nomicfoundation/hardhat-toolbox";
import 'hardhat-test-utils';

const config: HardhatUserConfig = {
  solidity: {
    compilers: [
      {
        version: ">=0.4.0",
      },
      {
        version: "^0.6.2",
      },
      {
        version: "0.6.12",
      },
    ]
  }
};

export default config;
