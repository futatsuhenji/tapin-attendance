import { readFile } from 'node:fs/promises';


/**
 * 環境変数を取得する。もし存在しなければデフォルト値を返す。
 *
 * この関数はDockerのシークレット管理に対応している。
 * 具体的には、環境変数 `KEY` が設定されていればその値を返し、
 * そうでなければ `${KEY}_FILE` 環境変数で指定されたファイルの内容を返す。
 *
 * @param key - 環境変数のキー
 * @param defaultValue - 環境変数が見つからなかった場合に返すデフォルト値
 * @returns - 環境変数の値、またはデフォルト値
 */
export async function getEnvironmentValueOr(key: string, defaultValue: string): Promise<string> {
    const shellEnvironmentValue = process.env[key];
    if (shellEnvironmentValue !== undefined) {
        return shellEnvironmentValue;
    }

    try {
        const filePath = process.env[`${key}_FILE`];
        if (!filePath) {
            return defaultValue;
        }
        const fileContent = await readFile(filePath, 'utf8');
        return fileContent.trim();
    } catch {
        return defaultValue;
    }
}


/**
 * 環境変数を取得する。もし存在しなければエラーを投げる。
 *
 * この関数はDockerのシークレット管理に対応している。
 * 具体的には、環境変数 `KEY` が設定されていればその値を返し、
 * そうでなければ `${KEY}_FILE` 環境変数で指定されたファイルの内容を返す。
 *
 * @param key - 環境変数のキー
 * @returns - 環境変数の値
 * @throws - 環境変数が見つからなかった場合にエラーを投げる
 */
export async function getEnvironmentValueOrThrow(key: string): Promise<string> {
    const shellEnvironmentValue = process.env[key];
    if (shellEnvironmentValue !== undefined) {
        return shellEnvironmentValue;
    }

    try {
        const filePath = process.env[`${key}_FILE`];
        if (!filePath) {
            throw new Error(`Environment variable ${key}_FILE is not set.`);
        }
        const fileContent = await readFile(filePath, 'utf8');
        return fileContent.trim();
    } catch {
        throw new Error(`Environment variable ${key} is not set and no corresponding file found.`);
    }
}
