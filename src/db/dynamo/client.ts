import {
  DynamoDBClient,
  ListTablesCommand,
  DescribeTableCommand,
  PutItemCommand,
  ScanCommand,
  AttributeValue,
} from "@aws-sdk/client-dynamodb";

export class DynamoClient {
  client: DynamoDBClient;

  constructor(region: string) {
    this.client = new DynamoDBClient({ region }); // 'ap-northeast-1'
  }

  async describeTable(tableName: string) {
    // process.env.TEST_TABLE
    const command = new DescribeTableCommand({ TableName: tableName });
    return this.client.send(command);
  }

  async putItem(tableName: string, itemObj: Record<string, AttributeValue>) {
    const putCommand = new PutItemCommand({
      // process.env.TEST_TABLE
      TableName: tableName,
      Item: itemObj,
    });
    return this.client.send(putCommand);
  }

  async scanItems(tableName: string) {
    // process.env.TEST_TABLE
    return this.client.send(
      new ScanCommand({
        TableName: process.env.TEST_TABLE,
      })
    );
  }
}
