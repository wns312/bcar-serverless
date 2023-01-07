// https://github.com/googleapis/google-api-nodejs-client/tree/main/samples/sheets
import { google, sheets_v4 } from "googleapis"
import { envs } from "../../configs"
import { ResponseError } from "../../errors"
import { Account, KCRURL } from "../../types"

export class AccountSheetClient {
  static sheetName = envs.GOOGLE_ACCOUNT_SHEET_NAME
  static spreadsheetId = envs.GOOGLE_SPREAD_SHEET_ID
  static rangeStart = "A3"
  static rangeEnd = "F"
  sheets: sheets_v4.Sheets

  get range() {
    const sheetName = AccountSheetClient.sheetName
    const rangeStart = AccountSheetClient.rangeStart
    const rangeEnd = AccountSheetClient.rangeEnd
    return `${sheetName}!${rangeStart}:${rangeEnd}`
  }

  constructor(email: string, key: string) {
    const auth = new google.auth.JWT(email, undefined, key, ["https://www.googleapis.com/auth/spreadsheets"])
    this.sheets = google.sheets({ version: "v4", auth })
  }

  private convertAccounts(accountRawList: string[][]): Account[] {
    return accountRawList?.map(([id, pw, region, isTest, isError, logUrl, error]) => ({
      id,
      pw,
      region,
      isTestAccount: isTest == "TRUE" ? true : false,
      isErrorOccured: isError == "TRUE" ? true : false,
      logStreamUrl: isError ? logUrl : null,
      errorContent: isError ? error : null,
    }))
  }

  async getAccounts() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: AccountSheetClient.spreadsheetId,
      range: this.range,
    });
    if (response.status != 200) {
      console.error(response);
      throw new ResponseError(response.statusText)
    }
    const values = response.data.values as string[][]
    const accountRawList = values?.splice(1)
    return this.convertAccounts(accountRawList)
  }

  async getTestAccounts() {
    const accounts = await this.getAccounts()
    return accounts.filter(account => account.isTestAccount)
  }

  async getTestAccount() {
    const testAccounts = await this.getTestAccounts()
    if (!testAccounts.length) {
      throw new Error("There is no test account");
    }
    return testAccounts[0]
  }

  async appendAccount(id: string, pw: string, isTestAccount: boolean) {
    const response = await this.sheets.spreadsheets.values.append({
      spreadsheetId: AccountSheetClient.spreadsheetId,
      range: AccountSheetClient.sheetName,
      valueInputOption: "USER_ENTERED",
      requestBody: {
        values: [ [id, pw, isTestAccount, false] ]
      }
    })
    if (response.status != 200) {
      console.error(response);
      throw new ResponseError(response.statusText)
    }
    return response.data
  }
}

export class KCRURLSheetClient {
  static sheetName = envs.GOOGLE_KCRURL_SHEET_NAME
  static spreadsheetId = envs.GOOGLE_SPREAD_SHEET_ID
  static rangeStart = "A3"
  static rangeEnd = "D"
  sheets: sheets_v4.Sheets


  constructor(email: string, key: string) {
    const auth = new google.auth.JWT(email, undefined, key, ["https://www.googleapis.com/auth/spreadsheets"])
    this.sheets = google.sheets({ version: "v4", auth })
  }

  get range() {
    const sheetName = KCRURLSheetClient.sheetName
    const rangeStart = KCRURLSheetClient.rangeStart
    const rangeEnd = KCRURLSheetClient.rangeEnd
    return `${sheetName}!${rangeStart}:${rangeEnd}`
  }

  private convertAll(rawList: string[][]): KCRURL[] {
    return rawList?.map(([region, loginUrl, registerUrl, manageUrl]) =>({
      region,
      loginUrl,
      registerUrl,
      manageUrl,
    }))
  }

  async getAll() {
    const response = await this.sheets.spreadsheets.values.get({
      spreadsheetId: KCRURLSheetClient.spreadsheetId,
      range: this.range,
    });
    if (response.status != 200) {
      console.error(response);
      throw new ResponseError(response.statusText)
    }
    const values = response.data.values as string[][]
    const rawList = values?.splice(1)
    return this.convertAll(rawList)
  }
}
