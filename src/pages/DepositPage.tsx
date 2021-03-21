import React from "react";
import { useWeb3React } from "@web3-react/core";
import { AMOUNTS_DISABLED, CHAIN_ID } from "config";
import { getNoteStringAndCommitment } from "utils/snarks-functions";
import Spinner from "components/Spinner";
import Modal from "components/Modal";
import { ledger, valora } from "connectors";
import { useActiveWeb3React } from "hooks/web3";
import {
  useApproveCallback,
  ApprovalState,
  useDepositCallback,
  DepositState,
} from "hooks/writeContract";
import { TokenAmount, CELO, ChainId } from "@ubeswap/sdk";
import {
  requestValoraAuth,
  useInitValoraResponse,
} from "connectors/valora/valoraUtils";
import { instances } from "poof-token";

declare global {
  interface Window {
    // TODO no-any
    genZKSnarkProofAndWitness: any;
  }
}

// pass props and State interface to Component class
const DepositPage = () => {
  useInitValoraResponse();

  const { account } = useActiveWeb3React();
  const { activate } = useWeb3React();
  const [state, setState] = React.useState({
    celoAmount: 0.1, // default option
    anonymitySetSize: 0,
    noteString: "",
    anonymitySetLoading: false,
    showDepositInfo: false,
    showModal: false,
  });
  const [currency] = React.useState("celo");
  const tornadoAddress =
    instances[`netId${CHAIN_ID}`][currency].instanceAddress[state.celoAmount];
  const depositAmounts = Object.keys(
    instances[`netId${CHAIN_ID}`][currency].instanceAddress
  )
    .sort()
    .map(Number);
  const [approvalState, approveCallback] = useApproveCallback(
    new TokenAmount(
      CELO[ChainId.ALFAJORES],
      (state.celoAmount * 10 ** 18).toString()
    ),
    tornadoAddress
  );
  console.log("Approval", approvalState);
  const [depositState, depositCallback] = useDepositCallback(state.celoAmount);
  console.log("Deposit", depositState);

  const setAnonymitySetSize = async (amount: number) => {
    setState({ ...state, anonymitySetLoading: true });
    // TODO anonymity set size
    setState({ ...state, anonymitySetSize: 0, anonymitySetLoading: false });
  };

  // TODO balance of contract and divide
  //React.useEffect(() => {
  //setAnonymitySetSize(state.celoAmount);
  //}, [setAnonymitySetSize, state.celoAmount]);

  const loading =
    approvalState === ApprovalState.PENDING ||
    depositState === DepositState.PENDING;

  const connectLedgerWallet = async () => {
    await activate(ledger, undefined, true).catch(console.error);
  };

  const connectValoraWallet = async () => {
    const resp = await requestValoraAuth();
    valora.setSavedValoraAccount(resp);
    activate(valora, undefined, true).catch(console.error);
  };

  // set the amount of BTC which the user wants to deposit
  const changeSize = (size: number) => {
    setState({ ...state, celoAmount: size, showDepositInfo: false });

    // show anonymity set size for selected amount
    setAnonymitySetSize(size);
  };

  const closeModal = async () => {
    setState({ ...state, showModal: false });
  };

  const approveHandler = async () => {
    if (!account) {
      return;
    }
    approveCallback();
  };

  const depositHandler = async () => {
    if (!account) {
      return;
    }

    try {
      const celoAmount = state.celoAmount;
      // TODO verify sufficient balance
      //const tokenInstance = new Contract(
      //TOKEN_ADDRESS.alfajores,
      //tokenABI,
      //getProviderOrSigner(library, account),
      //);

      // check if the user has sufficient token balance
      // TODO
      // const usersTokenBalance = await tokenInstance.methods.balanceOf(userAddress).call();
      // if (usersTokenBalance < celoAmount * 10 ** 18) {
      //   setState({...state, showModal: true, loading: false});
      //   throw 'Insufficient balance of CELO tokens';
      // }

      // ----- DEPOSIT TX -----
      // et noteString and commitment
      console.log("getting noteString");

      const { noteString, commitment } = getNoteStringAndCommitment(
        currency,
        celoAmount,
        CHAIN_ID
      );
      console.log("Commitment", commitment);

      // send deposit Tx
      depositCallback(commitment);
      setState({ ...state, showDepositInfo: true, noteString });
    } catch (error) {
      console.log("Error occured while making deposit");
      console.error(error);
      setState({ ...state });
    }
  };

  const amountOptions = (
    <ul className="deposit-amounts-ul">
      {depositAmounts.map((amount, index) => (
        <li key={index}>
          <label className="container">
            {amount} CELO
            <input
              checked={state.celoAmount === amount}
              type="radio"
              name="amounts"
              id={index.toString()}
              value={amount}
              onChange={() => changeSize(amount)}
              disabled={loading || AMOUNTS_DISABLED.includes(amount)} // don't allow the user to change CELO amount while transactions are being provessed
            />
            <span className="checkmark" />
          </label>
        </li>
      ))}
    </ul>
  );

  // show deposit information is available
  let depositInfo = <></>;
  if (state.noteString !== "" && !loading && state.showDepositInfo) {
    depositInfo = (
      <div className="deposit-info-div">
        <h3>Success!</h3>
        <p>Keep this note. It allows you to withdraw anonymized CELO.</p>
        <div className="notestring">{state.noteString}</div>
      </div>
    );
  }

  let approveButton = (
    <button
      className="make-deposit-button hover-button"
      onClick={approveHandler}
    >
      Approve
    </button>
  );

  let connectWalletButtons = (
    <>
      <button
        className="make-deposit-button hover-button"
        onClick={connectLedgerWallet}
      >
        Connect with Ledger
      </button>
      <button
        className="make-deposit-button hover-button"
        onClick={connectValoraWallet}
      >
        Connect with Valora
      </button>
    </>
  );

  let depositButton = <></>;
  if (account) {
    if (state.showDepositInfo) {
      depositButton = <></>;
    } else {
      depositButton = (
        <button
          className="make-deposit-button hover-button"
          onClick={depositHandler}
        >
          Deposit
        </button>
      );
    }
  }

  let loadingApprove = <></>;
  if (approvalState === ApprovalState.PENDING) {
    loadingApprove = (
      <div>
        <p className="sending-tx-label">Sending approve transaction...</p>
      </div>
    );
  }

  let loadingDeposit = <></>;
  if (depositState === DepositState.PENDING) {
    loadingDeposit = (
      <div>
        <p className="sending-tx-label">Sending deposit transaction...</p>
      </div>
    );
  }

  let insufficientBalanceModal = <></>;
  if (state.showModal) {
    insufficientBalanceModal = (
      <Modal modalClosed={closeModal} show={state.showModal}>
        <h2>Insufficient balance</h2>
        <p>
          You don't have enough CELO tokens. You need {state.celoAmount} CELO.
          You can get more CELO{" "}
          <a
            target="_blank"
            rel="noopener noreferrer"
            href="https://celo.org/developers/faucet"
          >
            here
          </a>
          .
        </p>
      </Modal>
    );
  }

  let button = connectWalletButtons;
  if (account) {
    if (approvalState === ApprovalState.NOT_APPROVED) {
      button = approveButton;
    } else {
      button = depositButton;
    }
  }

  return (
    <div>
      <h3 className="deposit-headline">Specify a CELO amount to deposit</h3>

      {amountOptions}
      {/*
      TODO
            <h3 className="anonymity-size">
                Anonymity set size: {state.anonymitySetSize === -1 ? <>Loading...</> : <b>{state.anonymitySetSize}</b>}
              </h3>
        */}

      {depositInfo}

      {insufficientBalanceModal}

      {loading ? (
        <>
          <Spinner />
          {loadingApprove}
          {loadingDeposit}
        </>
      ) : (
        <>{button}</>
      )}
      {account && <p>Account: {account}</p>}
    </div>
  );
};

export default DepositPage;
