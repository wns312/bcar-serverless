import {
  AttributeValue,
  BatchWriteItemCommand,
  BatchWriteItemCommandInput,
  DeleteItemCommand,
  DeleteItemCommandInput,
  DescribeTableCommand,
  DynamoDBClient,
  ExecuteStatementCommand,
  ExecuteStatementCommandInput,
  PutItemCommand,
  PutItemCommandInput,
  PutRequest,
  QueryCommand,
  QueryCommandInput,
  ScanCommand,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";
import { ResponseError } from "../../errors"
import { chunk } from "../../utils/index"

class DynamoBaseClient {
  client: DynamoDBClient;

  constructor(region: string) {
    this.client = new DynamoDBClient({ region }); // 'ap-northeast-2'
  }

  async describeTable(tableName: string) {
    const command = new DescribeTableCommand({ TableName: tableName });
    return this.client.send(command);
  }

  async putItem(input: PutItemCommandInput) {
    return this.client.send(new PutItemCommand(input));
  }

  async scanItems(input: ScanCommandInput) {
    return this.client.send(new ScanCommand(input));
  }

  async queryItems(input: QueryCommandInput) {
    return this.client.send(new QueryCommand(input));
  }

  async executeStatement(input: ExecuteStatementCommandInput) {
    return this.client.send(new ExecuteStatementCommand(input))
  }

  async batchWriteItem(input: BatchWriteItemCommandInput) {
    return this.client.send(new BatchWriteItemCommand(input))
  }

  async deleteItems(input: DeleteItemCommandInput) {
    return this.client.send(new DeleteItemCommand(input))
  }

}

export class DynamoClient {
  baseClient: DynamoBaseClient;
  tableName: string;
  indexName: string;

  constructor(region: string, tableName: string, indexName: string) {
    this.baseClient = new DynamoBaseClient(region);
    this.tableName = tableName;
    this.indexName = indexName;
  }

  getCar(carNum: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :p and SK = :s",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR-${carNum}` },
        ":s": { S: `#CAR-${carNum}` },
      },
    });
  }

  getUser(userId: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :p and SK = :s",
      ExpressionAttributeValues: {
        ":p": { S: `#USER-${userId}` },
        ":s": { S: `#USER-${userId}` },
      },
    });
  }

  getPost(carNum: string, userId: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :p and SK = :s",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR-${carNum}` },
        ":s": { S: `#USER-${userId}` },
      },
    });
  }

  getCarWithPost(carNum: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :p",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR-${carNum}` },
      },
    });
  }

  getUserWithPost(userId: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      IndexName: this.indexName,
      KeyConditionExpression: "SK = :s",
      ExpressionAttributeValues: {
        ":s": { S: `#USER-${userId}` },
      },
    });
  }

  getAllPostOfCar(carNum: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      KeyConditionExpression: "PK = :p and begins_with(SK, :s)",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR-${carNum}` },
        ":s": { S: `#USER` },
      },
    });
  }


  getAllPostOfUser(userId: string) {
    return this.baseClient.queryItems({
      TableName: this.tableName,
      IndexName: this.indexName,
      KeyConditionExpression: "SK = :s and begins_with(PK, :p)",
      ExpressionAttributeValues: {
        ":s": { S: `#USER-${userId}` },
        ":p": { S: `#CAR` },
      },
    });
  }

  // https://docs.aws.amazon.com/ko_kr/amazondynamodb/latest/developerguide/Scan.html
  // https://docs.aws.amazon.com/ko_kr/amazondynamodb/latest/developerguide/Scan.html#:~:text=%EC%9A%A9%EB%9F%89%20%EB%8B%A8%EC%9C%84%EB%A5%BC%20%EC%82%AC%EC%9A%A9%ED%95%A9%EB%8B%88%EB%8B%A4.-,%EB%B3%91%EB%A0%AC%20%EC%8A%A4%EC%BA%94,-%EA%B8%B0%EB%B3%B8%EC%A0%81%EC%9C%BC%EB%A1%9C%20Scan%20%EC%9E%91%EC%97%85%EC%9D%80

  // 여기에야말로 지터가 들어가야될 수도 있음.
  private async getAllCarNumberSegment(segment: number, segmentSize: number, exclusiveStartKey?:Record<string, AttributeValue>) {
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression: "begins_with(SK, :s) and begins_with(PK, :p)",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR` },
        ":s": { S: `#CAR` },
      },
      Segment: segment,
      TotalSegments: segmentSize,
      ProjectionExpression: "CarNumber",
      ExclusiveStartKey: exclusiveStartKey
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    let resultObj = {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }

    if (result.LastEvaluatedKey) {
      const additionalItems = await this.getAllCarNumberSegment(segment, segmentSize, result.LastEvaluatedKey)
      resultObj.items = [...resultObj.items, ...additionalItems.items]
      resultObj.count += additionalItems.count
    }
    return resultObj
  }

  async getAllCarNumber(segmentSize: number) {
    const promiseList: Promise<{items: Record<string, AttributeValue>[], count: number}>[] = []
    for (let segmentIndex = 0; segmentIndex  < segmentSize; segmentIndex++) {
      promiseList.push(this.getAllCarNumberSegment(segmentIndex, segmentSize))
    }
    const results = await Promise.all(promiseList)

    return results.reduce((obj, resultObj)=>{
      return { items: [...obj.items, ...resultObj.items], count: obj.count + resultObj.count}
      }, { items: [], count: 0})
  }

  getAllCarCountSegment(segmentSize: number) {
    const list: ScanCommandInput[] = []
    for (let i = 0; i < segmentSize; i++) {
      list.push({
        TableName: this.tableName,
        FilterExpression: "begins_with(SK, :s) and begins_with(PK, :p)",
        ExpressionAttributeValues: {
          ":p": { S: `#CAR` },
          ":s": { S: `#CAR` },
        },
        Select: "COUNT",
        Segment: i,
        TotalSegments: segmentSize,
      })
    }
    const promiseResults = list.map(input => this.baseClient.scanItems(input))
    return Promise.all(promiseResults)
  }

  getAllCarCount() {
    const result = this.baseClient.scanItems({
      TableName: this.tableName,
      FilterExpression: "begins_with(SK, :s) and begins_with(PK, :p)",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR` },
        ":s": { S: `#CAR` },
      },
      Select: "COUNT",
    })
    return result
  }
  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-functions.size.html
  // USER별 POST COUNT가 특정 수 이하인 USER의 목록을 뽑을 수 있어야 함: Query와 Scan의 SELECT 옵션에서 COUNT를 지정할 수 있음
  rawQuery(query: string) {
    return this.baseClient.executeStatement({
      Statement: query
    })
  }

  async batchPutItems(...putRequestInputs: PutRequest[]) {
    const input = putRequestInputs.map(input=> {
      return { PutRequest: input }
    })
    const createRequestInputChunks = chunk(input, 25);

    const promiseResponses = createRequestInputChunks.map(putRequests => {
      return this.baseClient.batchWriteItem({
        RequestItems: {
          [this.tableName]: putRequests
        }
      });
    })

    return Promise.all(promiseResponses)
  }

  async batchDeleteCar(carsShouldDelete: string[]) {

    const deleteRequestInput = carsShouldDelete.map(car => {
      return {
        DeleteRequest : {
          Key: {
            PK: { S: `#CAR-${car}`},
            SK: { S: `#CAR-${car}`},
          }
        }
      }
    })
    const deleteRequestInputChunks = chunk(deleteRequestInput, 25);

    const promiseResponses = deleteRequestInputChunks.map(deleteRequests => {
      return this.baseClient.batchWriteItem({
        RequestItems: {
          [this.tableName] : deleteRequests
        }
      })
    })
    return Promise.all(promiseResponses)
  }


  private async getAllCarsSegment(segment: number, segmentSize: number, exclusiveStartKey?:Record<string, AttributeValue>) {
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression: "begins_with(SK, :s) and begins_with(PK, :p)",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR` },
        ":s": { S: `#CAR` },
      },
      Segment: segment,
      TotalSegments: segmentSize,
      ExclusiveStartKey: exclusiveStartKey
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    let resultObj = {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }

    if (result.LastEvaluatedKey) {
      const additionalItems = await this.getAllCarsSegment(segment, segmentSize, result.LastEvaluatedKey)
      resultObj.items = [...resultObj.items, ...additionalItems.items]
      resultObj.count += additionalItems.count
    }
    return resultObj
  }

  async getAllCars(segmentSize: number) {
    const promiseList: Promise<{items: Record<string, AttributeValue>[], count: number}>[] = []
    for (let segmentIndex = 0; segmentIndex  < segmentSize; segmentIndex++) {
      promiseList.push(this.getAllCarsSegment(segmentIndex, segmentSize))
    }
    const results = await Promise.all(promiseList)

    return results.reduce((obj, resultObj)=>{
      return { items: [...obj.items, ...resultObj.items], count: obj.count + resultObj.count}
      }, { items: [], count: 0})
  }

  // for test : 용량을 덜 사용하기 위함
  async getSomeCars() {
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression: "begins_with(SK, :s) and begins_with(PK, :p)",
      ExpressionAttributeValues: {
        ":p": { S: `#CAR` },
        ":s": { S: `#CAR` },
      },
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }


    return {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }
  }

}


type Filter = {
  key: string,
  value: string
}

export class DynamoCategoryClient {
  baseClient: DynamoBaseClient;
  tableName: string;
  indexName: string;

  constructor(region: string, tableName: string, indexName: string) {
    this.baseClient = new DynamoBaseClient(region);
    this.tableName = tableName;
    this.indexName = indexName;
  }

  private async scanWithStartString(PK: string, SK?: string) {
    const result = await this.baseClient.scanItems({
      TableName: this.tableName,
      FilterExpression: `begins_with(PK, :p) and begins_with(SK, :s)`,
      ExpressionAttributeValues: {
        ":p": { S: PK },
        ":s": { S: SK || PK },
      }
    })

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    return {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }
  }

  private async segmentScanWithStartString(
    PK: string,
    segment: number,
    segmentSize: number,
    SK?: string,
    exclusiveStartKey?:Record<string, AttributeValue>,
  ) {
    const FilterExpression = "begins_with(SK, :s) and begins_with(PK, :p)"
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression,
      ExpressionAttributeValues: {
        ":p": { S: PK },
        ":s": { S: SK || PK },
      },
      Segment: segment,
      TotalSegments: segmentSize,
      ExclusiveStartKey: exclusiveStartKey
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }
    let resultObj = {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }

    if (result.LastEvaluatedKey) {
      const additionalItems = await this.segmentScanWithStartString(PK, segment, segmentSize, SK, result.LastEvaluatedKey)
      resultObj.items = [...resultObj.items, ...additionalItems.items]
      resultObj.count += additionalItems.count
    }
    return resultObj
  }

  private async scanWithFilter(PK: string, filter: Filter, SK?: string) {
    let FilterExpression = `begins_with(SK, :s) and begins_with(PK, :p) and ${filter.key} = :${filter.key}`

    let ExpressionAttributeValues =  {
      ":p": { S: PK },
      ":s": { S: SK || PK },
      [`:${filter.key}`]: { S: filter.value },
    }
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression,
      ExpressionAttributeValues
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    return {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }
  }

  getAllCarSegments() {
    return this.scanWithStartString('#SEGMENT')
  }

  getAllCarCompanies() {
    return this.scanWithStartString('#COMPANY')
  }

  getDomesticCarCompany() {
    return this.scanWithFilter(
      '#COMPANY',
      {
        key: "origin",
        value: "DOMESTIC"
      }
    )
  }
  getImportedCarCompany() {
    return this.scanWithFilter(
      '#COMPANY',
      {
        key: "origin",
        value: "IMPORTED"
      }
    )
  }

  getAllCarModels() {
    return this.scanWithStartString('#MODEL', '#COMPANY')
  }

  getCompanyCarModels(company: string) {
    return this.scanWithFilter(
      '#MODEL',
      {
        key: "company",
        value: company
      },
      '#COMPANY',
    )
  }

  async getAllCarDetails(segmentSize: number) {
    const promiseList: Promise<{items: Record<string, AttributeValue>[], count: number}>[] = []
    for (let segmentIndex = 0; segmentIndex  < segmentSize; segmentIndex++) {
      promiseList.push(this.segmentScanWithStartString('#DETAIL', segmentIndex, segmentSize, '#MODEL'))
    }
    const results = await Promise.all(promiseList)

    return results.reduce((obj, resultObj)=>{
      return { items: [...obj.items, ...resultObj.items], count: obj.count + resultObj.count}
      }, { items: [], count: 0})
  }

  getCompanyCarDetails(company: string) {
    return this.scanWithFilter(
      '#DETAIL',
      {
        key: "company",
        value: company
      },
      '#MODEL',
    )
  }
}

export class DynamoUploadedCarClient {
  baseClient: DynamoBaseClient;
  tableName: string;
  indexName: string;

  constructor(region: string, tableName: string, indexName: string) {
    this.baseClient = new DynamoBaseClient(region);
    this.tableName = tableName;
    this.indexName = indexName;
  }

  // 이거 재귀호출이면 안됨. 어차피 LastEvaluatedKey로 순차 조회할 것이므로 그냥 리턴하고 다시 호출이 되어야 함
  private async segmentScanWithStartString(
    PK: string,
    segment: number,
    segmentSize: number,
    SK?: string,
    exclusiveStartKey?:Record<string, AttributeValue>,
  ) {
    const FilterExpression = "begins_with(SK, :s) and begins_with(PK, :p)"
    const scanCommandInput = {
      TableName: this.tableName,
      FilterExpression,
      ExpressionAttributeValues: {
        ":p": { S: PK },
        ":s": { S: SK || PK },
      },
      Segment: segment,
      TotalSegments: segmentSize,
      ExclusiveStartKey: exclusiveStartKey
    }
    const result = await this.baseClient.scanItems(scanCommandInput)

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }
    let resultObj = {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }

    if (result.LastEvaluatedKey) {
      const additionalItems = await this.segmentScanWithStartString(PK, segment, segmentSize, SK, result.LastEvaluatedKey)
      resultObj.items = [...resultObj.items, ...additionalItems.items]
      resultObj.count += additionalItems.count
    }
    return resultObj
  }

  // PK만 필수고, 나머지는 옵션으로 들어가는것이 맞음
  // 옵션은 별도의 객체로 나오는 것이 맞다.
  private async scanWithStartString(PK: string, SK?: string) {
    const result = await this.baseClient.scanItems({
      TableName: this.tableName,
      FilterExpression: `begins_with(PK, :p) and begins_with(SK, :s)`,
      ExpressionAttributeValues: {
        ":p": { S: PK },
        ":s": { S: SK || PK },
      }
    })

    if (result.$metadata.httpStatusCode !== 200) {
      throw new ResponseError(`${result.$metadata}`)
    }

    return {
      items: result.Items ? result.Items : [],
      count: result.Count!
    }
  }

  async batchPutItems(...putRequestInputs: PutRequest[]) {
    const input = putRequestInputs.map(
      input=> ({ PutRequest: input })
    )
    const createRequestInputChunks = chunk(input, 25);

    return Promise.all(createRequestInputChunks.map(
      putRequests => this.baseClient.batchWriteItem({
        RequestItems: {
          [this.tableName]: putRequests
        }
      })
    ))
  }


  async scanUpdatedCars(segmentSize: number) {
    const promiseList: Promise<{items: Record<string, AttributeValue>[], count: number}>[] = []
    for (let segmentIndex = 0; segmentIndex  < segmentSize; segmentIndex++) {
      promiseList.push(this.segmentScanWithStartString('#USER', segmentIndex, segmentSize, '#CAR'))
    }
    const results = await Promise.all(promiseList)

    return results.reduce((obj, resultObj)=>{
      return { items: [...obj.items, ...resultObj.items], count: obj.count + resultObj.count}
      }, { items: [], count: 0})
  }
}
