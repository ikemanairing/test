# Plate Tectonics Simulation Utilities

이 저장소는 Git 사용 테스트를 위한 공간으로 시작했으며, 현재는 판구조론의
겉보기 극이동(apparent polar wander)과 실제 대륙 이동의 관계를 시각화하는
파이썬 시뮬레이션 스크립트를 포함하고 있습니다.

## 시뮬레이션 실행 방법

`apparent_polar_wander_simulation.py` 스크립트는 단순화된 판 운동 모델을
기반으로 대륙의 실제 이동 경로와 겉보기 극이동 경로를 비교한 그림을
생성합니다. 실행 전 `numpy`와 `matplotlib` 패키지가 설치되어 있어야 합니다.

```bash
pip install numpy matplotlib
```

기본 매개변수로 실행하면 `polar_wander_simulation.png` 파일을 생성하고, 표
형식의 요약 데이터를 터미널에 출력합니다.

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

생성된 그림은 대륙 이동 경로와 겉보기 극 이동 경로를 나란히 배치하여,
두 현상이 어떻게 연결되는지를 직관적으로 보여줍니다.
