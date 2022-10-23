# Serverless - BCar

## Todo
- [x] First deploy
- [x] Apply Typescript
- [x] Apply Puppeteer
- [x] Connect DB (maybe DynamoDB)
- [x] Find the way how to join dynamodb tables
- [x] Database Design
### Implements
- [x] Create DynamoClient with DynamoBaseClient 
- [x] Login into target crawl page
- [x] Crawl car list asynchronously
- [x] Crawl single data successfully
- [x] Create new lambda which getting details
- [x] Invoke detail crawl lambda async
- [x] Crawl detail list asynchronously (impossible. multi browser raise error)
- [x] Create compare logic which should be saved & deleted from (DB, target pages)
- [x] Save into Table
- [ ] Delete non-selling cars from database
- [ ] Add price attribute into saving data (this has to be updated always)
- [ ] Save target upload page's accounts
- [ ] ...more

## Packages
- chrome-aws-lambda: 10.1.0
- puppeteer-core: 10.4.0
- @aws-sdk/client-dynamodb
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


# Data
### Detail에서 수집하는 항목
- '차종' : Category
- '배기량' : Displacement
- '차량번호' : CarNumber
- '연식' : ModelYear
- '주행거리' : Mileage
- '색상' : Color
- '변속기' : Gearbox
- '연료' : FuelType
- '제시번호' : PresentationNumber
- '사고유무' : HasAccident
- '등록번호' : RegisterNumber
- '제시일' : PresentationsDate
- '압류 / 저당' : hasMortgage
