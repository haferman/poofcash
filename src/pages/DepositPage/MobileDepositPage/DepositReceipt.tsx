import React from "react";
import { Button, Container, Flex, Text } from "theme-ui";
import moment from "moment";
import { BlockscoutTxLink } from "components/Links";
import { BottomDrawer } from "components/BottomDrawer";
import { LabelWithBalance } from "components/LabelWithBalance";
import { shortenAccount } from "hooks/accountName";
import { NETWORK_COST } from "pages/DepositPage/MobileDepositPage/ConfirmDeposit";
import { SummaryTable } from "components/SummaryTable";
import { useContractKit } from "@celo-tools/use-contractkit";

interface IProps {
  onDoneClick: () => void;
  selectedAmount: string;
  selectedCurrency: string;
  txHash: string;
}

export const DepositReceipt: React.FC<IProps> = ({
  onDoneClick,
  selectedAmount,
  selectedCurrency,
  txHash,
}) => {
  const { address } = useContractKit();

  return (
    <Container>
      <Text sx={{ mb: 1 }} variant="subtitle">
        Alakazam!
      </Text>
      <br />
      <Text sx={{ mb: 4 }} variant="regular">
        Your deposit is complete.{" "}
        <BlockscoutTxLink tx={txHash}>View transaction</BlockscoutTxLink>.
      </Text>
      <br />

      <SummaryTable
        title="Transaction"
        lineItems={[
          {
            label: "Time completed",
            value: moment().format("h:mm a"),
          },
          {
            label: "Account",
            value: shortenAccount(address),
          },
          {
            label: "Est. total amount",
            value: `${
              Number(selectedAmount) + NETWORK_COST
            } ${selectedCurrency.toUpperCase()}`,
          },
        ]}
        totalItem={{
          label: "Deposit",
          value: `${Number(selectedAmount)} ${selectedCurrency.toUpperCase()}`,
        }}
      />

      <BottomDrawer>
        <Flex sx={{ justifyContent: "space-between" }}>
          <LabelWithBalance
            label="Deposited"
            amount={selectedAmount}
            currency={selectedCurrency.toUpperCase()}
          />
          <Button
            onClick={() => {
              onDoneClick();
            }}
            variant="done"
          >
            Done
          </Button>
        </Flex>
      </BottomDrawer>
    </Container>
  );
};
