# Serverless - BCar

## Todo
- [x] First deploy
- [x] Apply Typescript
- [x] Apply Puppeteer
- [ ] Connect DB (maybe DynamoDB)
- [ ] Connect S3
- [ ] Implements

## Packages
- chrome-aws-lambda: 10.1.0
- puppeteer-core: 10.4.0
### Dev Packages
- typescript
- serverless-plugin-typescript
- serverless-offline
- @types/aws-lambda
- puppeteer: 10.1.0

# Errors
### Type error
- make Disable Automatic Type Acquisition as true (in vscode settings)
### `libnss3.so` error
- fix nodejs version as 14.x, not 16.x ([ref](https://github.com/alixaxel/chrome-aws-lambda/issues/164#issuecomment-1126808120))