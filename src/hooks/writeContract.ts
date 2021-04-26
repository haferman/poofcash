import React from "react";
import { TokenAmount } from "@ubeswap/sdk";
import { useGetTokenAllowance } from "./readContract";
import { useActiveWeb3React } from "./web3";
import { useTokenContract, useTornadoTokenContract } from "./getContract";
import { calculateGasMargin } from "utils/gas";
import { TransactionResponse } from "@ethersproject/providers";
import { MaxUint256 } from "@ethersproject/constants";
import { CHAIN_ID } from "config";
import { instances } from "@poofcash/poof-token";

export enum ApprovalState {
  UNKNOWN = "UNKNOWN",
  NOT_APPROVED = "NOT_APPROVED",
  PENDING = "PENDING",
  WAITING_CONFIRMATIONS = "WAITING_CONFIRMATIONS",
  APPROVED = "APPROVED",
}

export enum DepositState {
  UNKNOWN = "UNKNOWN",
  PENDING = "PENDING",
  DONE = "DONE",
}

export function useApproveCallback(
  amountToApprove: TokenAmount,
  spender?: string
): [ApprovalState, () => Promise<void>] {
  const { account } = useActiveWeb3React();
  const token = amountToApprove.token;
  const getCurrentAllowance = useGetTokenAllowance(token, account, spender);
  const [approvalState, setApprovalState] = React.useState(
    ApprovalState.UNKNOWN
  );
  const [allowance, setAllowance] = React.useState<TokenAmount | undefined>();

  // TODO, this is kind of fragile
  React.useEffect(() => {
    if (account && Number(amountToApprove.toExact()) > 0) {
      const asyncSetCurrentAllowance = async () => {
        try {
          const currentAllowance = await getCurrentAllowance();
          setAllowance(currentAllowance);
        } catch (e) {
          console.error(e);
        }
      };
      asyncSetCurrentAllowance();
    }
  }, [account, approvalState, getCurrentAllowance, amountToApprove]);

  // check the current approval status
  React.useEffect(() => {
    if (approvalState === ApprovalState.PENDING) {
      return;
    }
    if (allowance && amountToApprove) {
      if (allowance.lessThan(amountToApprove)) {
        setApprovalState(ApprovalState.NOT_APPROVED);
      } else {
        setApprovalState(ApprovalState.APPROVED);
      }
    }
  }, [approvalState, amountToApprove, allowance]);

  const tokenContract = useTokenContract(token.address);

  const approve = React.useCallback(async (): Promise<void> => {
    if (approvalState !== ApprovalState.NOT_APPROVED) {
      console.error("approve was called unnecessarily");
      return;
    }

    if (!token) {
      console.error("no token");
      return;
    }

    if (!tokenContract) {
      console.error("tokenContract is null");
      return;
    }

    if (!amountToApprove) {
      console.error("missing amount to approve");
      return;
    }

    if (!spender) {
      console.error("no spender");
      return;
    }

    setApprovalState(ApprovalState.PENDING);
    const useExact = false;
    const estimatedGas = await tokenContract.estimateGas
      .approve(spender, MaxUint256)
      .catch(() => {
        // general fallback for tokens who restrict approval amounts
        return tokenContract.estimateGas.approve(
          spender,
          amountToApprove.raw.toString()
        );
      });

    tokenContract
      .approve(
        spender,
        useExact ? amountToApprove.raw.toString() : MaxUint256,
        {
          gasLimit: calculateGasMargin(estimatedGas),
        }
      )
      .then(async (response: TransactionResponse) => {
        setApprovalState(ApprovalState.WAITING_CONFIRMATIONS);
        await response.wait(1); // Wait for 1 confirmation
        setApprovalState(ApprovalState.APPROVED);
      })
      .catch((error: Error) => {
        console.debug("Failed to approve", error);
        alert(error.message);
        setApprovalState(ApprovalState.NOT_APPROVED);
      });
  }, [approvalState, token, tokenContract, amountToApprove, spender]);

  return [approvalState, approve];
}

export function useDepositCallback(
  amountToDeposit: number,
  commitment: string
): [DepositState, string, () => Promise<void>] {
  const [depositState, setDepositState] = React.useState(DepositState.UNKNOWN);
  const [txHash, setTxHash] = React.useState("");

  // Reset deposit state when there is a new commitment
  React.useEffect(() => setDepositState(DepositState.UNKNOWN), [commitment]);

  const tornadoContract = useTornadoTokenContract(
    instances[`netId${CHAIN_ID}`]["celo"].instanceAddress[amountToDeposit],
    true
  );

  const deposit = React.useCallback(async (): Promise<void> => {
    setDepositState(DepositState.PENDING);
    return tornadoContract
      ?.deposit(commitment, [], { gasLimit: 2 * 10 ** 6 }) // TODO hardcoded limit
      .then((response: TransactionResponse) => {
        setTxHash(response.hash);
        setDepositState(DepositState.DONE);
      })
      .catch((error: Error) => {
        setDepositState(DepositState.UNKNOWN);
        console.debug("Failed to deposit", error);
        alert(error.message);
      });
  }, [tornadoContract, setDepositState, setTxHash, commitment]);

  return [depositState, txHash, deposit];
}
