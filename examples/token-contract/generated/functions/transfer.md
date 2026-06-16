# transfer

Transfer tokens from one account to another.

## Parameters

| Name | Type | Description |
|------|------|-------------|
| from | Address | Keypair of the transaction source. |
| to | Address | Destination address. |
| amount | i128 | Amount of tokens to transfer. |

## Example

```typescript
await contract.transfer({
  from: "GD...",
  to: "GB...",
  amount: 1000n
});
```
