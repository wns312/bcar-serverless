import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
  DescribeTableCommand,
  PutItemCommand,
  PutItemCommandInput,
  ScanCommand,
  ScanCommandInput,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";

class DynamoBaseClient {
  client: DynamoDBClient;

  constructor(region: string) {
    this.client = new DynamoDBClient({ region }); // 'ap-northeast-1'
  }

  async describeTable(tableName: string) {
    // process.env.TEST_TABLE
    const command = new DescribeTableCommand({ TableName: tableName });
    return this.client.send(command);
  }

  async putItem(input: PutItemCommandInput) {
    // const putCommand = new PutItemCommand({
    //   TableName: process.env.BCAR_TABLE,
    //   Item: {
    //         PK: { S: "#CAR-5678"},
    //         SK: { S: "#CAR-5678"},
    //         CarNum: {N: "5678"}
    //       },
    // });
    return this.client.send(new PutItemCommand(input));
  }

  async scanItems(input: ScanCommandInput) {
    return this.client.send(new ScanCommand(input));
  }

  async queryItems(input: QueryCommandInput) {
    // process.env.TEST_TABLE
    // return this.client.send(
    //   new QueryCommand({
    //     TableName: tableName,
    //     KeyConditionExpression: "PK = :p and SK = :s",
    //     ExpressionAttributeValues: {
    //       ":p": {S: pk},
    //       ":s": {S: sk}
    //     }
    //   })
    // );
    return this.client.send(new QueryCommand(input));
  }

  // async batchGetItem(tableName: string) {
  //   return this.client.send(
  //     new BatchGetItemCommand({
  //       RequestItems: {
  //         [tableName] : {
  //           ConsistentRead: true,
  //           Keys: [
  //             {
  //               PK: {S: "#CAR"},
  //               SK: {S: "#USER"},
  //             },
  //             {
  //               PK: {S: "#CAR"},
  //               SK: {S: "#CAR"},
  //             },
  //             // {
  //             //   PK: {S: "#BCAR"},
  //             //   BCar: {S: "#CAR"}
  //             // },
  //             // {
  //             //   PK: {S: "#BCAR"},
  //             //   BCar: {S: "#POSTCAR"}
  //             // },
  //           ],
  //         }
  //       }
  //     })
  //   );
  // }
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

  scan() {
    return this.baseClient.scanItems({
      TableName: this.tableName,
    });
  }
  // USER별 POST COUNT가 특정 수 이하인 USER의 목록을 뽑을 수 있어야 함: Query와 Scan의 SELECT 옵션에서 COUNT를 지정할 수 있음

  // executeStatement라는 메소드를 쓰면 SQL 쿼리와 같은 것을 활용해서 데이터를 가져올 수 있음.
  // https://docs.aws.amazon.com/amazondynamodb/latest/developerguide/ql-functions.size.html

  // PENDING: Implement when really need this.
  // scanAll(limit: number) {
  //   return this.baseClient.scanItems({
  //     TableName: this.tableName,
  //     Limit: limit,
  //     ExclusiveStartKey: lastEvaluatedKey,
  //   });
  // }

  // PENDING: Implement when really need this.
  // scanAllWithSegment(limit: number, segment: number) {
  //   return this.baseClient.scanItems({
  //     TableName: this.tableName,
  //     Limit: 10,
  //     Segment: 1,
  //     TotalSegments: 2,
  //   });
  // }
  // Scan
  // (https://docs.aws.amazon.com/ko_kr/amazondynamodb/latest/developerguide/Scan.html)
  // (https://docs.aws.amazon.com/ko_kr/amazondynamodb/latest/developerguide/Scan.html#:~:text=%EC%9A%A9%EB%9F%89%20%EB%8B%A8%EC%9C%84%EB%A5%BC%20%EC%82%AC%EC%9A%A9%ED%95%A9%EB%8B%88%EB%8B%A4.-,%EB%B3%91%EB%A0%AC%20%EC%8A%A4%EC%BA%94,-%EA%B8%B0%EB%B3%B8%EC%A0%81%EC%9C%BC%EB%A1%9C%20Scan%20%EC%9E%91%EC%97%85%EC%9D%80)
  // 아무 정보없이 모든 데이터를 가져와야 할 때가 있을 것
  // 그리고 포스팅 된 Car, 포스팅 되지 않은 Car에 대한 구현도 필요할 것
}
