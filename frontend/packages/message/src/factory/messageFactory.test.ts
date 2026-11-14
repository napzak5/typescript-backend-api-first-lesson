import { describe, expect, it } from 'vitest'
import { messageFactory } from './messageFactory'

describe('messageFactory', () => {
  describe('validation', () => {
    const validation = messageFactory.createRepository().validation()

    it('should describe a minimum count with the default unit', () => {
      // Act
      const result = validation.requiredMinValue(3)

      // Assert
      expect(result).toBe('3個以上です')
    })

    it('should describe a minimum count with a custom unit', () => {
      // Act
      const result = validation.requiredMinValue(8, '文字')

      // Assert
      expect(result).toBe('8文字以上です')
    })

    it('should describe a maximum count with the default unit', () => {
      // Act
      const result = validation.requiredMaxValue(5)

      // Assert
      expect(result).toBe('5個以下です')
    })

    it('should describe a maximum count with a custom unit', () => {
      // Act
      const result = validation.requiredMaxValue(20, '文字')

      // Assert
      expect(result).toBe('20文字以下です')
    })

    it('should describe the lower bound of a range', () => {
      // Act
      const result = validation.requiredMinBetweenValue(1)

      // Assert
      expect(result).toBe('1以上です')
    })

    it('should describe the upper bound of a range', () => {
      // Act
      const result = validation.requiredMaxBetweenValue(100)

      // Assert
      expect(result).toBe('100以内です')
    })

    it('should name the user when no feature is given for an invalid id', () => {
      // Act
      const result = validation.invalidId()

      // Assert
      expect(result).toBe('不正なユーザーIDです')
    })

    it('should name the given feature for an invalid id', () => {
      // Act
      const result = validation.invalidId('サロン')

      // Assert
      expect(result).toBe('不正なサロンIDです')
    })

    it('should omit the brackets when no invalid parameter is given', () => {
      // Act
      const result = validation.invalidParams()

      // Assert
      expect(result).toBe('不正な引数です')
    })

    it('should list a single invalid parameter', () => {
      // Act
      const result = validation.invalidParams('salonId')

      // Assert
      expect(result).toBe('不正な引数です[salonId]')
    })

    it('should list every invalid parameter separated by commas', () => {
      // Act
      const result = validation.invalidParams('salonId', 42, true)

      // Assert
      expect(result).toBe('不正な引数です[salonId,42,true]')
    })
  })

  describe('feedback', () => {
    const feedback = messageFactory.createRepository().feedback()

    it('should report success of a generic process by default', () => {
      // Act
      const result = feedback.success()

      // Assert
      expect(result).toBe('処理に成功しました')
    })

    it('should report success of the named process', () => {
      // Act
      const result = feedback.success('予約')

      // Assert
      expect(result).toBe('予約に成功しました')
    })

    it('should report failure of a generic process by default', () => {
      // Act
      const result = feedback.error()

      // Assert
      expect(result).toBe('処理に失敗しました')
    })

    it('should report failure of the named process', () => {
      // Act
      const result = feedback.error('予約')

      // Assert
      expect(result).toBe('予約に失敗しました')
    })
  })

  describe('date format messages', () => {
    it('should name its own field in each message', () => {
      // Arrange
      const repository = messageFactory.createRepository()

      // Act
      const messages = [
        repository.startDate().invalidFormat(),
        repository.endDate().invalidFormat(),
        repository.birthday().invalidFormat(),
      ]

      // Assert
      expect(messages).toEqual([
        '開始日はyyyy-mm-dd形式で入力してください',
        '終了日はyyyy-mm-dd形式で入力してください',
        '生年月日はyyyy-mm-dd形式で入力してください',
      ])
    })
  })

  describe('katakana messages', () => {
    it('should distinguish half-width from full-width katakana', () => {
      // Arrange
      const katakana = messageFactory.createRepository().katakana()

      // Act
      const messages = [
        katakana.invalidHalfWidthKatakana(),
        katakana.invalidFullWidthKatakana(),
      ]

      // Assert
      expect(messages).toEqual(['半角カタカナのみです', '全角カタカナのみです'])
    })
  })
})
