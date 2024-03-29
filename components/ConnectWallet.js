import React, { useState, useEffect } from "react";
import styled from "styled-components";
import { ethers } from "ethers";
import Web3Modal from "web3modal";
import WalletConnectProvider from "@walletconnect/web3-provider";
import Chip from "@mui/material/Chip";

import showMessage from "./showMessage";
import { set, get, subscribe } from "../widget/store";
import { formatAddress, padWidth } from "../widget/utils";
import RinkebyContractABI from "../abi/rinkeby.json";
import MainnetContractABI from "../abi/mainnet.json";

const CHAIN_ID = process.env.NEXT_PUBLIC_CHAIN_ID;
const NETWORK = CHAIN_ID === "1" ? "mainnet" : "rinkeby";
const contractABI = CHAIN_ID === "1" ? MainnetContractABI : RinkebyContractABI;

const providerOptions = {
  walletconnect: {
    package: WalletConnectProvider,
    options: {
      infuraId: process.env.NEXT_PUBLIC_INFURA_PROJECT_ID,
    },
  },
};

let web3ModelInstance;
if (typeof window !== "undefined") {
  web3ModelInstance = new Web3Modal({
    network: process.env.NEXT_PUBLIC_CHAIN_ID === "1" ? "mainnet" : "rinkeby",
    cacheProvider: true,
    providerOptions,
  });
}

let provider;
let signer;
let instance;//web3ModelInstance
let contract;

export async function connectWallet() {
  console.log("log------CONTRACT_ADDRESS",process.env.NEXT_PUBLIC_CONTRACT_ADDRESS);
  if (!instance) {
    instance = await web3ModelInstance.connect();
    // https://docs.ethers.io/v5/api/providers/
    provider = new ethers.providers.Web3Provider(instance);
    // https://docs.ethers.io/v5/api/signer/
    signer = provider.getSigner();
    contract = new ethers.Contract(
      process.env.NEXT_PUBLIC_CONTRACT_ADDRESS,
      // 大哥，注意 ABI 的大小写 👻
      contractABI.abi,
      provider
    );
  }

  return { provider, signer, web3Instance: instance, contract };
}

async function disconnectWallet() {
  provider = undefined;
  signer = undefined;
  instance = undefined;
  contract = undefined;
  await web3ModelInstance.clearCachedProvider();
}


/****
 * 链接钱包的component
 * 3种数据来源  state LocalStorage web3ModelInstance
 *  state LocalStorage 的数据要一致  web3ModelInstance实例要清除干净
 */
function ConnectWallet(props) {
  const [address, setAddress] = useState(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const addressInStore = get("address") || null;
    if (addressInStore) {
      setAddress(addressInStore);
    }
    subscribe("address", () => {
      const addressInStore = get("address") || null;
      setAddress(addressInStore);
    });
  }, []);

  if (address && !loading) {
    return (
      <Chip
        style={{fontSize: '1.15rem',padding:'0 5px',background: "#F0F0F0",fontFamily:'Montserrat-SemiBoldItalic'}}
        label={address}
        onDelete={async () => {
          await disconnectWallet();
          setAddress(null);
          set("address", "");
          set("fullAddress", "");
        }}
      />
    );
  }

  return (
      <Chip
        style={{fontSize: '1.15rem', padding:'0 5px',background: "#F0F0F0",fontFamily:'Montserrat-SemiBoldItalic'}}
        label={loading ? "Connecting..." : "Connect Wallet"}
        onClick={async () => {
          setLoading(true);
          try {
            const { provider, signer, web3Instance } = await connectWallet();
            const address = await signer.getAddress();
            const ens = await provider.lookupAddress(address);
            setAddress(ens || formatAddress(address));
            set("address", ens || formatAddress(address));
            set("fullAddress", address);
            web3Instance.on("accountsChanged", async (accounts) => {
              if (accounts.length === 0) {
                await disconnectWallet();
                set("address", "");
                set("fullAddress", "");
                setAddress(null);
              } else {
                const address = accounts[0];
                const ens = await provider.lookupAddress(address);
                setAddress(ens || formatAddress(address));
                set("address", ens || formatAddress(address));
                set("fullAddress", address);
              }
            });
            gtag('event', 'wallet_address', 
            {'wallet_address': 'wallet_address','address':address});
          } catch (err) {
            await disconnectWallet();
            set("address", "");
            set("fullAddress", "");
            setAddress(null);
            showMessage({
              type: "error",
              title: "Failed to connect wallet, please try again",
              body: err.message,
            });
          }
          setLoading(false);
          gtag('event', 'click_connect_wallet', {'click_connect_wallet': 'click_connect_wallet'});
        }}
      />
  );
}

export default ConnectWallet;
