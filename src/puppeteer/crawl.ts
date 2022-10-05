import { PuppeteerNode } from "puppeteer-core";
import { DynamoBaseClient } from "../db/dynamo/DynamoBaseClient";
import { DynamoCarClient } from "../db/dynamo/DynamoCarClient";

async function test() {
  const client = new DynamoBaseClient("ap-northeast-1");
  const tableName = process.env.BCAR_TABLE!;
  const indexName = process.env.BCAR_INDEX!;

  const tables = await client.describeTable(tableName);
  console.log(tables.Table);
  console.log(tables.Table?.AttributeDefinitions);
  console.log(tables.Table?.KeySchema);
  const carClient = new DynamoCarClient("ap-northeast-1");
  const res = await carClient.getPost(tableName, "5678");
  const res2 = await carClient.getCar(tableName, "5678");
  console.log(res.Items);
  console.log(res2.Items);
  return;

  // const res1 = await client.QueryItems({
  //   TableName: tableName,
  //   KeyConditionExpression: "PK = :p and SK = :s",
  //   ExpressionAttributeValues: {
  //     ":p": { S: "#CAR-5678" },
  //     ":s": { S: "#USER-JYK" },
  //   },
  // });
  // console.log(1);
  // console.log(res1.Items);
  // const res3 = await client.QueryItems({
  //   TableName: tableName,
  //   IndexName: indexName,
  //   KeyConditionExpression: "SK = :s",
  //   ExpressionAttributeValues: {
  //       ":s": {S: "#USER-JYK"}
  //   }
  // })
  // console.log(res3.Items);
  //   const putRes = await client.putItem({
  //     TableName: tableName,
  //     Item: {
  //       PK: { S: "#CAR-5678" },
  //       SK: { S: "#CAR-5678" },
  //       CarNum: { N: "5678" },
  //     },
  //   });
  //   const putRes2 = await client.putItem({
  //     TableName: tableName,
  //     Item: {
  //       PK: { S: "#CAR-9999" },
  //       SK: { S: "#CAR-9999" },
  //       CarNum: { N: "9999" },
  //     },
  //   });
  //   const putRes3 = await client.putItem({
  //     TableName: tableName,
  //     Item: {
  //       PK: { S: "#USER-JYK" },
  //       SK: { S: "#USER-JYK" },
  //       Name: { S: "JYK" },
  //     },
  //   });
  //   const putRes4 = await client.putItem({
  //     TableName: tableName,
  //     Item: {
  //       PK: { S: "#CAR-5678" },
  //       SK: { S: "#USER-JYK" },
  //       postNum: { S: "Post1" },
  //     },
  //   });
  //   const putRes5 = await client.putItem({
  //     TableName: tableName,
  //     Item: {
  //       PK: { S: "#CAR-9999" },
  //       SK: { S: "#USER-JYK" },
  //       postNum: { S: "Post2" },
  //     },
  //   });
  // console.log(putRes);
  // console.log(putRes2);
  // console.log(putRes3);
  // console.log(putRes4);
  // console.log(putRes5);
  //   const scanRes = await client.scanItems({
  //     TableName: tableName,
  //     FilterExpression: "begins_with(PK, :p)",
  //     ExpressionAttributeValues: {
  //       ":p": { S: "#USER" },
  //     },
  //   });

  //   const chromium = require("chrome-aws-lambda");
  //   const puppeteer: PuppeteerNode = chromium.puppeteer
  //   const browser = await puppeteer.launch({
  //     args: chromium.args,
  //     defaultViewport: chromium.defaultViewport,
  //     executablePath: await chromium.executablePath,
  //     headless: chromium.headless
  //   });
  //   var [page] = await browser.pages();
  //   // const page = await browser.newPage();
  //   // waitUntil을 사용해야 로딩이 된다.
  //   await page.goto('http://mastermotors.co.kr/car/carView.html?m_no=8448854', { waitUntil: 'load' });

  //   let data_len = await page.$$eval( "#detail_box > div.right > div > div.carContTop > ul > li", data => {
  //       return data.length;
  //   });

  //   // 차 정보 가져오는 부분
  //   let carInfoKeys = []
  //   let carInfoValues = []
  //   for (let index = 1; index < data_len+1; index++) {
  //       carInfoKeys.push(
  //           page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.tit`, (data)=>{
  //               return data.textContent
  //           })
  //       )
  //       carInfoValues.push(
  //           page.$eval(`#detail_box > div.right > div > div.carContTop > ul > li:nth-child(${index}) > span.txt`, (data)=>{
  //               return data.textContent ? data.textContent.trim() : ''
  //           })
  //       )
  //   }
  //   const carCheckSrc = await page.$eval(`#detail_box > div:nth-child(21) > iframe`, (element)=>{
  //       return element.getAttribute('src')
  //   })

  //   // 이미지만 가져오기
  //   const imgLen = await page.$$eval(`#detail_box > div:nth-child(16) > a`, (element)=>{
  //       return element.length
  //   })
  //   const carImgList = []
  //   for (let index = 1; index < imgLen+1; index++) {
  //       carImgList.push(
  //           await page.$eval(`#detail_box > div:nth-child(16) > a:nth-child(${index}) > img`, (element)=>{
  //               return element.getAttribute('src')
  //           })
  //       )
  //   }
  //   console.log(await Promise.all(carInfoKeys));
  //   console.log(await Promise.all(carInfoValues));
  //   console.log(carCheckSrc);
  //   console.log(carImgList);

  //   await browser.close();
}

export { test };
