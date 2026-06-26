import json
import os
import urllib.request
import urllib.parse

def handler(event: dict, context) -> dict:
    """Отправка SMS с кодом подтверждения через СМС.ру"""

    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Methods': 'POST, OPTIONS',
                'Access-Control-Allow-Headers': 'Content-Type',
                'Access-Control-Max-Age': '86400',
            },
            'body': '',
        }

    raw = event.get('body') or '{}'
    # Парсим: body может быть dict, str->dict, или str->str->dict
    if isinstance(raw, str):
        parsed = json.loads(raw)
        body = json.loads(parsed) if isinstance(parsed, str) else parsed
    else:
        body = raw
    phone = body.get('phone', '').strip()
    code  = body.get('code', '').strip()

    if not phone or not code:
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'phone и code обязательны'}),
        }

    # Нормализуем номер: оставляем только цифры, приводим к формату 7XXXXXXXXXX
    digits = ''.join(c for c in phone if c.isdigit())
    if digits.startswith('8'):
        digits = '7' + digits[1:]
    if len(digits) != 11 or not digits.startswith('7'):
        return {
            'statusCode': 400,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': 'Некорректный номер телефона'}),
        }

    api_key = os.environ.get('SMSRU_API_KEY', '')

    # Если ключ не задан — демо-режим (возвращаем код в ответе)
    if not api_key:
        print(f'[SMS DEMO] → {digits}: {code}')
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': True, 'demo': True, 'code': code}),
        }

    # Реальная отправка через СМС.ру
    text = f'КорпМессенджер: ваш код подтверждения — {code}'
    params = urllib.parse.urlencode({
        'api_id': api_key,
        'to':     digits,
        'msg':    text,
        'json':   1,
    })
    url = f'https://sms.ru/sms/send?{params}'

    try:
        with urllib.request.urlopen(url, timeout=10) as resp:
            result = json.loads(resp.read().decode())
    except Exception as e:
        return {
            'statusCode': 502,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': False, 'error': f'Ошибка запроса: {e}'}),
        }

    # СМС.ру: status_code 100 = успех
    sms_status = result.get('sms', {}).get(digits, {}).get('status_code')
    if result.get('status') == 'OK' and sms_status == 100:
        return {
            'statusCode': 200,
            'headers': {'Access-Control-Allow-Origin': '*'},
            'body': json.dumps({'ok': True}),
        }

    err = result.get('sms', {}).get(digits, {}).get('status_text', 'Ошибка отправки')
    return {
        'statusCode': 502,
        'headers': {'Access-Control-Allow-Origin': '*'},
        'body': json.dumps({'ok': False, 'error': err}),
    }