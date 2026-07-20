cmake_minimum_required(VERSION 3.13)
project(automotive_someip_rig CXX)

set(CMAKE_CXX_STANDARD 17)
set(CMAKE_CXX_STANDARD_REQUIRED ON)

# vsomeip3 was installed to /usr/local by vsomeip/00-build.sh
find_package(vsomeip3 REQUIRED)
find_package(Boost 1.55 REQUIRED COMPONENTS system thread)
find_package(Threads REQUIRED)

add_executable(lidar_service lidar_service.cpp)
target_include_directories(lidar_service PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${Boost_INCLUDE_DIRS})
target_link_libraries(lidar_service vsomeip3 ${Boost_LIBRARIES} Threads::Threads)

add_executable(steering_client steering_client.cpp)
target_include_directories(steering_client PRIVATE ${CMAKE_CURRENT_SOURCE_DIR} ${Boost_INCLUDE_DIRS})
target_link_libraries(steering_client vsomeip3 ${Boost_LIBRARIES} Threads::Threads)
