import {
  DynamoDBClient,
  QueryCommand,
  QueryCommandInput,
  BatchGetItemCommand,
  DescribeTableCommand,
  PutItemCommand,
  PutItemCommandInput,
  ScanCommand,
  AttributeValue,
  ScanCommandInput,
} from "@aws-sdk/client-dynamodb";

export class DynamoBaseClient {
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

  async QueryItems(input: QueryCommandInput) {
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
