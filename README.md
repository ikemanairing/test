# Plate Tectonics Simulation Utilities

이 저장소는 Git 사용 연습을 위해 시작되었으며, 현재는 판구조론의 겉보기 극이동
(apparent polar wander, APW)과 실제 대륙 이동을 비교해 볼 수 있는 두 가지 도구를
제공합니다.

1. **파이썬 스크립트** – `apparent_polar_wander_simulation.py`
2. **브라우저 기반 인터랙티브 시각화** – `web/` 폴더의 정적 웹 앱

## 브라우저에서 실험하기

웹 버전은 추가 설치 없이 실행할 수 있도록 HTML, CSS, JavaScript만으로 구성되어
있습니다. 단순히 정적 파일을 브라우저로 열거나, 필요하다면 간단한 개발용 서버로
호스팅하면 됩니다.

```bash
# 저장소 루트에서 실행
python -m http.server 8000
```

이후 브라우저에서 <http://localhost:8000/web/> 주소를 열면 됩니다. 좌측 패널에서
오일러 회전극과 시뮬레이션 기간 등을 조절하면 오른쪽의 두 그래프와 요약 표가
즉시 갱신되며, 대륙 이동 경로와 APW 경로의 차이를 실시간으로 비교할 수 있습니다.

## 파이썬 스크립트 실행 방법

`apparent_polar_wander_simulation.py` 스크립트는 단순화된 판 운동 모델을 기반으로
대륙의 실제 이동 경로와 겉보기 극이동 경로를 비교한 그림을 생성합니다. 실행 전
`numpy`와 `matplotlib` 패키지가 설치되어 있어야 합니다.

```bash
pip install numpy matplotlib
```

기본 매개변수로 실행하면 `polar_wander_simulation.png` 파일을 생성하고, 표 형식의
요약 데이터를 터미널에 출력합니다.

```bash
python apparent_polar_wander_simulation.py
```

주요 옵션은 다음과 같습니다.

| 옵션 | 설명 |
| --- | --- |
| `--angular-velocity` | 백만 년당 회전 각속도(도) |
| `--axis-lat`, `--axis-lon` | 오일러 회전극의 위도, 경도 |
| `--total-time` | 시뮬레이션 기간(백만 년) |
| `--time-steps` | 시간 분해능 |
| `--continent-lat`, `--continent-lon` | 현재 대륙 기준점의 위도/경도 |
| `--output` | 저장될 이미지 파일 경로 |
| `--show` | 저장 후 그래프를 화면에 표시 |

예를 들어, 다른 회전축과 기간을 실험하려면 다음과 같이 실행할 수 있습니다.

```bash
python apparent_polar_wander_simulation.py \
    --angular-velocity 0.7 \
    --axis-lat 45 \
    --axis-lon 10 \
    --total-time 150 \
    --output custom_simulation.png
```

생성된 그림은 대륙 이동 경로와 겉보기 극 이동 경로를 나란히 배치하여, 두 현상이
어떻게 연결되는지를 직관적으로 보여줍니다.
